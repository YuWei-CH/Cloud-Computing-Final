import os
import json
import boto3
import requests
import pymysql
from datetime import datetime

# AWS clients
sqs = boto3.client('sqs')
QUEUE_URL      = os.environ['QUEUE_URL']

# RDS credentials (from env vars)
DB_HOST        = os.environ['DB_HOST']
DB_USER        = os.environ['DB_USER']
DB_PASSWORD    = os.environ['DB_PASSWORD']
DB_NAME        = os.environ['DB_NAME']

# External API keys
WEATHER_API_KEY = os.environ['WEATHER_API_KEY']
FLIGHT_API_KEY  = os.environ['FLIGHT_API_KEY']

def handler(event, context):
    # 1) Connect to RDS
    conn = pymysql.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        cursorclass=pymysql.cursors.DictCursor
    )

    try:
        # 2) Fetch all upcoming trips + user info
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                  t.id   AS trip_id,
                  u.id   AS user_id,
                  u.email,
                  t.start_city,
                  t.end_city
                FROM trips t
                JOIN users u ON u.id = t.user_id
                WHERE t.status = 'Upcoming'
            """)
            trips = cur.fetchall()

        # 3) For each trip, check weather + flight status
        for trip in trips:
            abnormal = {}
            city   = trip['end_city']

            # 3a) Weather check
            w = requests.get(
                'https://api.openweathermap.org/data/2.5/weather',
                params={'q': city, 'appid': WEATHER_API_KEY}
            ).json()
            cond = w.get('weather', [{}])[0].get('main', '')
            if cond in ('Rain', 'Snow', 'Thunderstorm'):
                abnormal['weather'] = cond

            # 3b) Flight check: load this user’s tickets
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT ticket_number FROM tickets WHERE user_id = %s",
                    (trip['user_id'],)
                )
                tickets = cur.fetchall()

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

                # SAFELY handle empty data array
                flight_data = f.get('data', [])
                if flight_data:
                    status = flight_data[0].get('flight_status', '').lower()
                    if status and status not in ('scheduled', 'active', 'on time'):
                        abnormal.setdefault('flight', []).append({
                            'number': flight_iata,
                            'status': status
                        })

            # 4) If any anomalies found, send to SQS
            if abnormal:
                msg = {
                    'email':      trip['email'],
                    'trip_id':    trip['trip_id'],
                    'start_city': trip['start_city'],
                    'end_city':   city,
                    'abnormal':   abnormal,
                    'timestamp':  datetime.utcnow().isoformat()
                }
                sqs.send_message(
                    QueueUrl=QUEUE_URL,
                    MessageBody=json.dumps(msg)
                )

    finally:
        conn.close()

    return {'statusCode': 200}
