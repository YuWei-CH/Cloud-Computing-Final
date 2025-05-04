import os, json, boto3, requests, pymysql
from datetime import datetime

# AWS SQS client
sqs = boto3.client('sqs')
QUEUE_URL      = os.environ['QUEUE_URL']

# RDS credentials
DB_HOST        = os.environ['DB_HOST']
DB_USER        = os.environ['DB_USER']
DB_PASSWORD    = os.environ['DB_PASSWORD']
DB_NAME        = os.environ['DB_NAME']

# External API keys
WEATHER_API_KEY = os.environ['WEATHER_API_KEY']
FLIGHT_API_KEY  = os.environ['FLIGHT_API_KEY']

def handler(event, context):
    # Connect to your RDS MySQL
    conn = pymysql.connect(
      host=DB_HOST,
      user=DB_USER,
      password=DB_PASSWORD,
      database=DB_NAME,
      cursorclass=pymysql.cursors.DictCursor
    )
    try:
        # Fetch all upcoming trips + user email
        with conn.cursor() as cur:
            cur.execute("""
              SELECT t.id AS trip_id, u.id AS user_id, u.email,
                     t.start_city, t.end_city
                FROM trips t
                JOIN users u ON u.id = t.user_id
               WHERE t.status = 'Upcoming'
            """)
            trips = cur.fetchall()

        for trip in trips:
            abnormal = {}
            city = trip['end_city']

            # 1) Weather check via OpenWeatherMap
            w = requests.get(
              'https://api.openweathermap.org/data/2.5/weather',
              params={'q': city, 'appid': WEATHER_API_KEY}
            ).json()
            cond = w.get('weather',[{}])[0].get('main','')
            if cond in ('Rain','Snow','Thunderstorm'):
                abnormal['weather'] = cond

            # 2) Flight check via AviationStack (per-user tickets)
            with conn.cursor() as cur:
                cur.execute(
                  "SELECT ticket_number FROM tickets WHERE user_id=%s",
                  (trip['user_id'],)
                )
                tickets = cur.fetchall()

            for tkt in tickets:
                code = tkt['ticket_number']
                f = requests.get(
                  'http://api.aviationstack.com/v1/flights',
                  params={
                    'access_key': FLIGHT_API_KEY,
                    'flight_iata': code,
                    'limit': 1
                  }
                ).json()
                status = f.get('data',[{}])[0].get('flight_status','').lower()
                if status and status not in ('scheduled','active','on time'):
                    abnormal.setdefault('flight', []).append({
                      'number': code,
                      'status': status
                    })

            # 3) Enqueue anomalies to SQS
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
