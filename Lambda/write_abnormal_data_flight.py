import os, json, boto3, pymysql, logging
from datetime import datetime
import requests

logger = logging.getLogger()
logger.setLevel(logging.DEBUG)

sqs            = boto3.client('sqs')
QUEUE_URL      = os.environ['QUEUE_URL']
DB_HOST        = os.environ['DB_HOST']
DB_USER        = os.environ['DB_USER']
DB_PASSWORD    = os.environ['DB_PASSWORD']
DB_NAME        = os.environ['DB_NAME']
FLIGHT_API_KEY = os.environ['FLIGHT_API_KEY']

def handler(event, context):
    logger.debug("=== Flight Writer start ===")
    conn = pymysql.connect(
        host=DB_HOST, user=DB_USER, password=DB_PASSWORD,
        database=DB_NAME, cursorclass=pymysql.cursors.DictCursor
    )
    try:
        # 1) Load all tickets departing tomorrow
        sql = """
            SELECT
              ticket_number,
              user_id,
              departure_datetime
            FROM tickets
            WHERE departure_datetime BETWEEN DATE(NOW()) AND DATE_ADD(DATE(NOW()), INTERVAL 1 DAY);
        """
        with conn.cursor() as cur:
            cur.execute(sql)
            tickets = cur.fetchall()

        # 2) Load all prior flight alerts
        with conn.cursor() as cur:
            cur.execute("SELECT ticket_number, user_id, last_status, depart_time FROM flight_alerts")
            prior = { (r['user_id'], r['ticket_number']) : r for r in cur }

        # 3) Process each ticket
        for tkt in tickets:
            iata         = tkt['ticket_number']
            user_id      = tkt['user_id']
            scheduled_dt = tkt['departure_datetime']

            # fetch user email & name
            with conn.cursor() as cur:
                cur.execute("SELECT email, username FROM users WHERE id=%s", (user_id,))
                u = cur.fetchone() or {}
            email = u.get('email')
            name  = u.get('username')

            # 4) Call flight API for current status
            resp = requests.get(
                'http://api.aviationstack.com/v1/flights',
                params={'access_key': FLIGHT_API_KEY, 'flight_iata': iata, 'limit': 1}
            )
            data = resp.json().get('data', [])
            if not data:
                continue
            f       = data[0]
            status  = f.get('flight_status','').lower()
            dep     = f.get('departure', {})
            est     = dep.get('estimated') or dep.get('scheduled')
            curr_dt = None
            if est:
                curr_dt = datetime.fromisoformat(est.replace('Z','+00:00')).replace(tzinfo=None)

            # 5) Compare against prior using composite key
            key        = (user_id, iata)
            prev       = prior.get(key, {})
            prev_stat  = prev.get('last_status')
            prev_depart= prev.get('depart_time')
            if prev_depart:
                prev_depart = prev_depart.replace(tzinfo=None)

            send = False
            if status in ('delayed','cancelled','diverted'):
                if status != prev_stat:
                    send = True
                elif prev_depart and curr_dt:
                    # more than one hour change since last alert?
                    delta = abs((curr_dt - prev_depart).total_seconds())
                    if delta > 3600:
                        send = True

            if send:
                # 6) Upsert into flight_alerts with composite key
                with conn.cursor() as cur2:
                    cur2.execute("""
                        INSERT INTO flight_alerts
                          (ticket_number, user_id, last_status, depart_time, alerted_at)
                        VALUES (%s, %s, %s, %s, NOW())
                        ON DUPLICATE KEY UPDATE
                          last_status = VALUES(last_status),
                          depart_time = VALUES(depart_time),
                          alerted_at  = NOW()
                    """, (iata, user_id, status, curr_dt))
                conn.commit()

                # 7) Enqueue notification payload
                msg = {
                    'email':   email,
                    'name':    name,
                    'flights': [{
                        'ticket':      iata,
                        'status':      status,
                        'depart_time': curr_dt.isoformat() if curr_dt else None
                    }]
                }
                sqs.send_message(QueueUrl=QUEUE_URL, MessageBody=json.dumps(msg))
                logger.info("Enqueued flight alert for %s (user %s)", iata, user_id)

    finally:
        conn.close()

    return {'statusCode': 200}
