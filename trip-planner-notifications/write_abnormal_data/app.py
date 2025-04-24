import os
import json
import boto3
import requests
import pymysql
from datetime import datetime

# AWS clients
sqs = boto3.client('sqs')
QUEUE_URL = os.environ['QUEUE_URL']

# RDS credentials (from env vars)
DB_HOST     = os.environ['DB_HOST']
DB_USER     = os.environ['DB_USER']
DB_PASSWORD = os.environ['DB_PASSWORD']
DB_NAME     = os.environ['DB_NAME']

# External API keys
WEATHER_API_KEY = os.environ['WEATHER_API_KEY']
FLIGHT_API_KEY  = os.environ['FLIGHT_API_KEY']

def handler(event, context):
    # 1) Connect to RDS
    conn = pymysql.connect(
        host=DB_HOST, user=DB_USER,
        password=DB_PASSWORD, database=DB_NAME,
        cursorclass=pymysql.cursors.DictCursor
    )
    try:
        with conn.cursor() as cur:
            # 2) Fetch all trips
            cur.execute("SELECT TripID, Email, City, FlightNumber FROM trips")
            trips = cur.fetchall()

        # 3) For each trip, call APIs & detect abnormal
        for trip in trips:
            abnormal = {}
            city   = trip['City']
            flight = trip.get('FlightNumber', '')

            # Weather API call
            w = requests.get(
                'https://api.openweathermap.org/data/2.5/weather',
                params={'q': city, 'appid': WEATHER_API_KEY}
            ).json()
            cond = w.get('weather', [{}])[0].get('main', '')
            if cond in ('Rain', 'Snow', 'Thunderstorm'):
                abnormal['weather'] = cond

            # Flight API call (placeholder URL)
            f = requests.get(
                'https://api.example.com/flight/status',
                params={'flight': flight, 'apikey': FLIGHT_API_KEY}
            ).json()
            status = f.get('status', '').lower()
            if status not in ('scheduled', 'active', 'on time'):
                abnormal['flight'] = status

            # 4) Send to SQS if anything abnormal
            if abnormal:
                msg = {
                    'email': trip['Email'],
                    'city': city,
                    'flight': flight,
                    'abnormal': abnormal,
                    'timestamp': datetime.utcnow().isoformat()
                }
                sqs.send_message(
                    QueueUrl=QUEUE_URL,
                    MessageBody=json.dumps(msg)
                )
    finally:
        conn.close()

    return {'statusCode': 200}
