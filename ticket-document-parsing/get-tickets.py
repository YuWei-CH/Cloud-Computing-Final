import os
import json
import datetime
import pymysql

# DB config via env vars
DB_HOST     = os.environ["DB_HOST"]
DB_USER     = os.environ["DB_USER"]
DB_PASSWORD = os.environ["DB_PASSWORD"]
DB_NAME     = os.environ["DB_NAME"]

def lambda_handler(event, context):
    # 1) get user_email
    params = event.get("queryStringParameters") or {}
    user_email = params.get("user_email")
    if not user_email:
        return {
            "statusCode": 400,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"    # if you need CORS
            },
            "body": json.dumps({"error": "Missing required query parameter: user_email"})
        }

    # 2) open DB connection
    conn = pymysql.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        cursorclass=pymysql.cursors.DictCursor
    )

    try:
        with conn.cursor() as cur:
            # 3) fetch user_id
            cur.execute("SELECT id FROM users WHERE email = %s", (user_email,))
            row = cur.fetchone()
            if not row:
                return {
                    "statusCode": 404,
                    "headers": {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*"    # if you need CORS
                    },
                    "body": json.dumps({"error": f"No user with email {user_email}"})
                }
            user_id = row["id"]

            # 4) fetch tickets
            cur.execute("""
                SELECT
                  id,
                  type,
                  ticket_number,
                  departure_datetime,
                  arrival_datetime,
                  departure_city,
                  arrival_city,
                  departure_code,
                  arrival_code,
                  seats
                FROM tickets
                WHERE user_id = %s
            """, (user_id,))
            tickets = cur.fetchall()

    finally:
        conn.close()

    # 5) split & sort
    now = datetime.datetime.now()
    past, future = [], []

    for t in tickets:
        # ensure we have datetime objects
        dep = t["departure_datetime"]
        if isinstance(dep, str):
            dep = datetime.datetime.fromisoformat(dep)
        if dep < now:
            past.append((dep, t))
        else:
            future.append((dep, t))

    # sort: past newest→oldest, future oldest→newest
    past_sorted   = [t for _, t in sorted(past,   key=lambda x: x[0], reverse=True)]
    future_sorted = [t for _, t in sorted(future, key=lambda x: x[0], reverse=False)]

    # 6) convert datetimes to ISO strings
    def serialize(ticket):
        out = ticket.copy()
        for f in ("departure_datetime", "arrival_datetime"):
            dt = out[f]
            # if datetime, output in ISO format WITHOUT changing tz
            if isinstance(dt, datetime.datetime):
                out[f] = dt.isoformat()
            # if it's already a string (e.g. VARCHAR column), leave it as is
        return out

    response_body = {
        "past":   [serialize(t) for t in past_sorted],
        "future": [serialize(t) for t in future_sorted]
    }

    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"    # if you need CORS
        },
        "body": json.dumps(response_body)
    }