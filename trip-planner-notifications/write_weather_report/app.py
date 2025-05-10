import os
import json
import boto3
import pymysql
import requests
import logging
from datetime import datetime, timedelta

# —————————————
# Configuration & clients
# —————————————
logger = logging.getLogger()
logger.setLevel(logging.DEBUG)

sqs             = boto3.client('sqs')
QUEUE_URL       = os.environ['QUEUE_URL']  # SQS queue for weather report messages
DB_HOST         = os.environ['DB_HOST']
DB_USER         = os.environ['DB_USER']
DB_PASSWORD     = os.environ['DB_PASSWORD']
DB_NAME         = os.environ['DB_NAME']
WEATHER_API_KEY = os.environ['WEATHER_API_KEY']  # OpenWeatherMap API key

# —————————————
# Recommendation matrix
# —————————————
RECOMMENDATIONS = {
    # Clear
    "Clear|cold|any|calm":    "Insulated coat, scarf & hat. ❄️ Outdoor hike or golden‑hour photos.",
    "Clear|cold|any|breezy":  "Insulated coat, scarf & hat. Brisk walk—stay layered.",
    "Clear|cool|any|calm":    "Light jacket & long sleeves. 🚶 City tour or café patio.",
    "Clear|cool|any|breezy":  "Light jacket & windbreaker. 🚶 Urban stroll.",
    "Clear|mild|any|calm":    "T‑shirt + light pants. 🚴 Biking or picnic.",
    "Clear|mild|any|breezy":  "T‑shirt + light pants. ☀️ Al fresco brunch.",
    "Clear|warm|any|calm":    "Shorts & breathable top + sunglasses. 🏖️ Beach or pool.",
    "Clear|warm|any|breezy":  "Shorts & breathable top. 🏖️ Beach stroll.",
    "Clear|hot|low|calm":     "Tank top & shorts, sunhat, sunscreen. 🏊‍♀️ Swim or mall (AC breaks).",
    "Clear|hot|high|calm":    "Moisture‑wicking fabrics & sunhat. 🌳 Shaded park or museum.",
    # Clouds
    "Clouds|cold|any|calm":   "Warm coat & layers. ☕ Café or indoor museum.",
    "Clouds|cold|any|breezy": "Warm layers + wind‑proof jacket. 🏛️ Indoor museum, cozy café.",
    "Clouds|cool|any|calm":   "Light jacket & long sleeves. 🚶 City stroll.",
    "Clouds|cool|any|breezy": "Light layers & windbreaker. 🚶 Gallery visits.",
    "Clouds|mild|any|calm":   "Long‑sleeve top & trousers. ☕ Rooftop café or light hike.",
    "Clouds|mild|any|breezy": "Light sweater & trousers. ☕ Patio or park walk.",
    "Clouds|warm|any|calm":   "Long‑sleeve top & light pants. ☀️ Al fresco brunch.",
    "Clouds|warm|any|breezy": "Long‑sleeve + windbreaker. 🚴 Scenic bike ride.",
    "Clouds|hot|any|calm":     "Light layers & breathable fabrics. 🌤️ Gentle hike or city stroll.",
    "Clouds|hot|any|breezy":   "Windbreaker & light pants. 🌤️ Breezy outdoor walking or outdoor café.",
    # Rain & co.
    "Rain|any|any|any":           "Waterproof jacket, boots & umbrella. 🏞️ Waterfall tour or aquarium.",
    "Drizzle|any|any|any":        "Light raincoat & water‑resistant shoes. 🛋️ Bookstore or indoor market.",
    "Thunderstorm|any|any|any":   "Stay dry—avoid outdoor plans. 🎥 Cinema or spa.",
    # Snow
    "Snow|any|any|any":           "Heavy coat, insulated boots, gloves & hat. ⛷️ Ski or snow‑shoe walk.",
    # Atmosphere
    "Mist|any|any|calm":          "Layers & high‑visibility jacket. 🚗 Drive carefully or brief stroll.",
    "Mist|any|any|breezy":        "Layers & wind‑proof coat. 🚗 Short indoor visits.",
    "Fog|any|any|any":            "Warm layers & reflective gear. 🚗 Stay cautious on drives.",
    "Haze|any|any|any":           "Light mask & long sleeves. 🌬️ Indoor air‑conditioned spots.",
    "Smoke|any|any|any":          "Protective mask & long sleeves. 🌬️ Indoor AC, light activity.",
    "Dust|any|any|any":           "Goggles & scarf over mouth. 🏜️ Quick outdoor stop, indoor visits.",
    "Sand|any|any|any":           "Goggles & scarf. 🏜️ Short outdoor stop, indoor refuge.",
    "Ash|any|any|any":            "Mask & long clothing. 🛖 Stay indoors if possible.",
    # Extreme
    "Squall|any|any|high":        "Emergency gear—stay indoors. 🛑 Shelter in place.",
    "Tornado|any|any|any":        "Seek immediate shelter. 🚨 Follow local warnings.",
    # fallback
    "default":                    "Dress comfortably and check a local weather app for last‑minute updates!"
}


def handler(event, context):
    logger.debug("=== Weather Writer start ===")
    conn = pymysql.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        cursorclass=pymysql.cursors.DictCursor
    )

    try:
        # Load tomorrow’s trips (include duration & destination)
        sql = """
            SELECT
              t.id           AS trip_id,
              u.email,
              u.username     AS name,
              t.start_city,
              t.end_city     AS destination,
              t.start_date,
              t.duration
            FROM trips t
            JOIN users u ON u.id = t.user_id
            WHERE DATE(t.start_date) = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
        """
        with conn.cursor() as cur:
            cur.execute(sql)
            trips = cur.fetchall()
        logger.info("Found %d trips for weather report", len(trips))

        # For each trip, fetch forecast and calculate daily stats
        for trip in trips:
            email       = trip['email']
            name        = trip['name']
            start_city  = trip['start_city']
            destination = trip['destination']
            city_short  = destination.split(',')[0]
            start_date  = trip['start_date']
            duration    = trip['duration'] or 1

            resp = requests.get(
                'https://api.openweathermap.org/data/2.5/forecast',
                params={'q': city_short, 'appid': WEATHER_API_KEY}
            )
            try:
                resp.raise_for_status()
                forecast_list = resp.json().get('list', [])
            except Exception:
                logger.error("Forecast fetch failed for %s", city_short)
                continue

            entries = []
            for i in range(duration):
                day = (start_date + timedelta(days=i)).isoformat()
                temps, winds, hums, pops = [], [], [], []
                condition = None
                for e in forecast_list:
                    dt = e.get('dt_txt')
                    if dt and dt.startswith(day):
                        main = e['main']
                        temps.append(main['temp'] - 273.15)
                        winds.append(e['wind']['speed'])
                        hums.append(main['humidity'])
                        pops.append(e.get('pop', 0.0))
                        if condition is None:
                            condition = e['weather'][0]['main']
                if not temps:
                    continue

                tmin = round(min(temps))
                tmax = round(max(temps))
                wavg = round(sum(winds)/len(winds), 1)
                havg = round(sum(hums)/len(hums))
                precip = round(max(pops)*100)

                # Banding
                if tmax <= 10: tb='cold'
                elif tmax <= 20: tb='cool'
                elif tmax <= 25: tb='mild'
                elif tmax <= 30: tb='warm'
                else: tb='hot'
                hb = 'high' if havg >= 60 else 'low'
                wb = 'calm' if wavg <= 5 else 'breezy' if wavg <= 10 else 'high'

                # Wildcard lookup
                key_parts = (condition, tb, hb, wb)
                rec = next((v for k,v in RECOMMENDATIONS.items()
                            if k!='default' and all(kp==cp or kp=='any'
                                for kp,cp in zip(k.split('|'), key_parts))),
                           RECOMMENDATIONS['default'])

                entries.append({
                    'date': day,
                    'condition': condition,
                    'temp_min': tmin,
                    'temp_max': tmax,
                    'precipitation': precip,
                    'humidity': havg,
                    'wind': wavg,
                    'recommendation': rec
                })

            if entries:
                sqs.send_message(
                    QueueUrl=QUEUE_URL,
                    MessageBody=json.dumps({
                        'email': email,
                        'name': name,
                        'start_city': start_city,
                        'destination': destination,
                        'weather': entries
                    })
                )
                logger.info("Enqueued weather report for %s→%s", start_city, destination)

    finally:
        conn.close()
        logger.debug("DB connection closed")

    return {'statusCode': 200}
    