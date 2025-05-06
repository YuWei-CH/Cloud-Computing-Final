import os
import json
import boto3
import requests
import pymysql
from datetime import datetime, timedelta
import logging

# —————————————
# Configuration & clients
# —————————————
logger = logging.getLogger()
logger.setLevel(logging.DEBUG)

sqs = boto3.client('sqs')
QUEUE_URL = os.environ['QUEUE_URL']

DB_HOST     = os.environ['DB_HOST']
DB_USER     = os.environ['DB_USER']
DB_PASSWORD = os.environ['DB_PASSWORD']
DB_NAME     = os.environ['DB_NAME']

WEATHER_API_KEY = os.environ['WEATHER_API_KEY']
FLIGHT_API_KEY  = os.environ['FLIGHT_API_KEY']

# —————————————
# Handler
# —————————————
def handler(event, context):
    logger.debug("=== Handler start ===\nEvent payload: %s", json.dumps(event))

    # 1) Connect to RDS
    conn = pymysql.connect(
        host=DB_HOST, user=DB_USER, password=DB_PASSWORD,
        database=DB_NAME, cursorclass=pymysql.cursors.DictCursor
    )

    try:
        # 2) Load all upcoming trips
        sql = """
            SELECT
              t.id          AS trip_id,
              u.id          AS user_id,
              u.email,
              u.username    AS name,
              t.start_city,
              t.end_city    AS city,
              t.start_date,
              t.duration
            FROM trips t
            JOIN users u ON u.id = t.user_id
            WHERE t.id NOT IN (SELECT trip_id FROM alerted_trips)
                AND t.start_date BETWEEN DATE(NOW()) 
                    AND DATE_ADD(DATE(NOW()), INTERVAL 5 DAY)
        """
        logger.debug("Executing SQL:\n%s", sql.strip())
        with conn.cursor() as cur:
            cur.execute(sql)
            trips = cur.fetchall()

        logger.info("Found %d upcoming trips", len(trips))
        
        # 3) Process each trip
        for trip in trips:
            trip_id    = trip['trip_id']
            user_email = trip['email']
            user_name  = trip['name']
            city_full  = trip['city']
            # during testing we’ll just use the primary city name
            city_param = city_full.split(',')[0]
            start_date = trip['start_date']
            duration   = trip['duration'] or 1
            user_id    = trip['user_id']

            logger.debug(
                "\n--- Trip %s ---\n"
                "User: %s (%s)\n"
                "Route: %s → %s\n"
                "Start: %s   Duration: %s days\n",
                trip_id, user_name, user_email,
                trip['start_city'], city_full,
                start_date, duration
            )

            abnormal = {}

            # 4) Build list of ISO dates we care about
            dates_to_check = {
                (start_date + timedelta(days=i)).isoformat()
                for i in range(duration)
            }
            logger.debug("Dates to check for weather anomalies: %s", dates_to_check)

            # ————————
            # Weather check via /forecast
            # ————————
            forecast_resp = requests.get(
                'https://api.openweathermap.org/data/2.5/forecast',
                params={'q': city_param, 'appid': WEATHER_API_KEY}
            )
            logger.debug(
                "FORECAST request → URL=%s\nStatus=%d\nBody snippet=%s",
                forecast_resp.url,
                forecast_resp.status_code,
                forecast_resp.text[:200].replace('\n',' ')
            )
            try:
                forecast_resp.raise_for_status()
                forecast_data = forecast_resp.json()
            except Exception as e:
                logger.error("Failed to fetch forecast for %s: %s", city_param, e)
                forecast_data = {}

            weather_alerts = []
            for entry in forecast_data.get('list', []):
                dt_txt = entry.get('dt_txt')
                if not dt_txt:
                    continue
                day = dt_txt.split(' ')[0]
                cond = entry['weather'][0]['main']
                pop  = entry.get('pop', 0.0)
                logger.debug("Forecast entry: %s → %s", day, cond)
                if day in dates_to_check and cond in ('Rain', 'Snow', 'Thunderstorm'):
                    logger.info(">>> Weather anomaly detected: %s on %s", cond, day)
                    weather_alerts.append({
                        'date':      day,
                        'condition': cond,
                        'pop': pop
                    })

            if weather_alerts:
                abnormal['weather'] = weather_alerts
                logger.debug("Collected weather anomalies: %s", weather_alerts)
            else:
                logger.debug("No weather anomalies for trip %s", trip_id)

            # ————————
            # Flight check
            # ————————
            # load all tickets for this user
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT ticket_number FROM tickets WHERE user_id=%s",
                    (user_id,)
                )
                tickets = cur.fetchall()
            logger.debug("Found %d tickets for user %s: %s", len(tickets), user_id, tickets)

            flight_alerts = []
            for tkt in tickets:
                iata = tkt['ticket_number']
                flight_resp = requests.get(
                    'http://api.aviationstack.com/v1/flights',
                    params={'access_key': FLIGHT_API_KEY, 'flight_iata': iata, 'limit': 3}
                )
                logger.debug(
                    "FLIGHT request → URL=%s\nStatus=%d",
                    flight_resp.url, flight_resp.status_code
                )
                fdata = flight_resp.json().get('data', [])
                logger.debug("Flight API returned %d records for %s", len(fdata), iata)

                for f in fdata:
                    status = f.get('flight_status','').lower()
                    fdate  = f.get('flight_date','')
                    logger.debug("Flight %s on %s → status=%s", iata, fdate, status)
                    if status and status not in ('scheduled','active','on time','landed'):
                        logger.info(">>> Flight anomaly: %s on %s is %s", iata, fdate, status)
                        flight_alerts.append({
                            'number': iata,
                            'date':   fdate,
                            'status': status
                        })

            if flight_alerts:
                abnormal['flight'] = flight_alerts
                logger.debug("Collected flight anomalies: %s", flight_alerts)
            else:
                logger.debug("No flight anomalies for trip %s", trip_id)

            # ————————
            # Enqueue if anything abnormal
            # ————————
            if abnormal:
                message = {
                    'email':      user_email,
                    'trip_id':    trip_id,
                    'start_city': trip['start_city'],
                    'end_city':   city_full,
                    'abnormal':   abnormal,
                    'timestamp':  datetime.utcnow().isoformat()
                }
                logger.debug("Enqueuing to SQS: %s", json.dumps(message))
                sqs.send_message(QueueUrl=QUEUE_URL, MessageBody=json.dumps(message))

                with conn.cursor() as cur:
                    cur.execute(
                        "INSERT INTO alerted_trips (trip_id, alerted_at) VALUES (%s, NOW())",
                        (trip_id,)
                    )
                conn.commit()
                logger.debug("Marked trip %s in alerted_trips", trip_id)
            else:
                logger.debug("Trip %s clean → nothing to enqueue", trip_id)
            

    finally:
        conn.close()
        logger.debug("Database connection closed")

    logger.debug("=== Handler complete ===")
    return {'statusCode': 200}
