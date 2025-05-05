import os
import json
import boto3
import requests
import pymysql
from datetime import datetime
import logging

logger = logging.getLogger()
logger.setLevel(logging.DEBUG)

# 1) SQS client & queue URL
sqs       = boto3.client('sqs')
QUEUE_URL = os.environ['QUEUE_URL']

# 2) RDS credentials
DB_HOST     = os.environ['DB_HOST']
DB_USER     = os.environ['DB_USER']
DB_PASSWORD = os.environ['DB_PASSWORD']
DB_NAME     = os.environ['DB_NAME']

# 3) External API keys
WEATHER_API_KEY = os.environ['WEATHER_API_KEY']
FLIGHT_API_KEY  = os.environ['FLIGHT_API_KEY']


def handler(event, context):
    # Connect to RDS
    conn = pymysql.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        cursorclass=pymysql.cursors.DictCursor
    )

    try:
        # Fetch all upcoming trips (start today or later)
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                  t.id          AS trip_id,
                  u.id          AS user_id,
                  u.email,
                  u.username    AS name,
                  t.start_city,
                  t.end_city,
                  t.start_date
                FROM trips t
                JOIN users u
                  ON u.id = t.user_id
                WHERE t.start_date >= CURDATE()
            """)
            trips = cur.fetchall()

        logger.debug(f"Found {len(trips)} upcoming trips")

        for trip in trips:
            trip_id    = trip['trip_id']
            user_email = trip['email']
            city       = trip['end_city']
            start_date = trip['start_date']
            user_id    = trip['user_id']

            logger.debug(f"Processing trip {trip_id} starting on {start_date} for {user_email}")

            # initialize anomaly accumulator
            abnormal = {}

            # --- Weather check ---
            w = requests.get(
                'https://api.openweathermap.org/data/2.5/weather',
                params={'q': city, 'appid': WEATHER_API_KEY}
            ).json()
            logger.debug(f"Weather for {city}: {w}")
            cond = w.get('weather', [{}])[0].get('main', '')
            if cond in ('Rain', 'Snow', 'Thunderstorm'):
                logger.info(f"Abnormal weather {cond} in {city}")
                abnormal['weather'] = cond

            # --- Flight check ---
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT ticket_number FROM tickets WHERE user_id = %s",
                    (user_id,)
                )
                tickets = cur.fetchall()

            flight_alerts = []
            for tkt in tickets:
                flight_iata = tkt['ticket_number']
                f = requests.get(
                    'http://api.aviationstack.com/v1/flights',
                    params={
                        'access_key': FLIGHT_API_KEY,
                        'flight_iata': flight_iata,
                        'limit': 1
                    }
                ).json()
                logger.debug(f"Flight status for {flight_iata}: {f}")
                data = f.get('data', [])
                if data:
                    status = data[0].get('flight_status', '').lower()
                    if status and status not in ('scheduled', 'active', 'on time', 'landed'):
                        logger.info(f"Abnormal flight {flight_iata}: {status}")
                        flight_alerts.append({
                            'number': flight_iata,
                            'status': status
                        })

            if flight_alerts:
                abnormal['flight'] = flight_alerts

            # --- Enqueue if any anomalies found ---
            if abnormal:
                message = {
                    'email':      user_email,
                    'trip_id':    trip_id,
                    'start_city': trip['start_city'],
                    'end_city':   city,
                    'abnormal':   abnormal,
                    'timestamp':  datetime.utcnow().isoformat()
                }
                logger.debug(f"Sending to SQS: {message}")
                sqs.send_message(
                    QueueUrl=QUEUE_URL,
                    MessageBody=json.dumps(message)
                )
            else:
                logger.debug("No anomalies; skipping SQS enqueue")

    finally:
        conn.close()

    return {'statusCode': 200}
