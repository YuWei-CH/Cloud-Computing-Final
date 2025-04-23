import json
import os
import uuid
import pymysql
import boto3
from openai import OpenAI

s3 = boto3.client("s3")
openai = OpenAI()

SYSTEM_PROMPT = """
You are a document-parsing assistant that extracts travel-ticket details and returns them as clean JSON.
For each ticket found, output an object with exactly these fields:
- type: one of [flight, train, bus]
- ticket_number:
  • if flight: carrier code + number (e.g. "AA1579")
  • if train: full train name (e.g. "151 Northeast Regional")
  • if bus: full bus name if present, otherwise "N/A"
- departure_datetime: UTC ISO 8601 string
- arrival_datetime: UTC ISO 8601 string
- departure_city
- arrival_city
- departure_code: airport or station code (optional; include only if present)
- arrival_code: airport or station code (optional; include only if present)
- seats: seat assignment (optional; include only if present)
Return a JSON array of these objects and nothing else.
"""

USER_PROMPT = "Please extract all tickets from the uploaded document and return the JSON."

# Database configuration
db_config = {
    'host': os.environ['DB_HOST'],
    'user': os.environ['DB_USER'],
    'password': os.environ['DB_PASSWORD'],
    'database': os.environ['DB_NAME']
}

def lambda_handler(event, context):
    # 1) extract inputs
    file_name = event.get("file_name")
    user_id = event.get("user_id")
    if not file_name or not user_id:
        raise ValueError("Must provide both file_name and user_id in event")

    # 2) verify that the file exists in the S3 bucket
    try:
        bucket = os.environ["BUCKET_NAME"]
        resp = s3.get_object(Bucket=bucket, Key=file_name)
    except s3.exceptions.NoSuchKey:
        raise FileNotFoundError(f"{file_name} not found in {bucket}")

    # 3) upload the file to OpenAI and obtain the file_id
    upload = openai.files.create(
        file=(file_name, resp["Body"], "application/pdf"),
        purpose="user_data"
    )
    file_id = upload.id

    # 4) call openAI API with the uploaded file
    chat_resp = openai.chat.completions.create(
        model="gpt-4.1-nano",
        messages=[
            {
                "role": "system",
                "content": SYSTEM_PROMPT
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "file",
                        "file": { "file_id": file_id }
                    },
                    {
                        "type": "text",
                        "text": USER_PROMPT
                    }
                ]
            }
        ]
    )
    raw = chat_resp.choices[0].message.content

    # 5) parse & validate JSON
    tickets = json.loads(raw)
    if not isinstance(tickets, list):
        raise ValueError("Expected a JSON array of tickets")
    required = {"type", "ticket_number", "departure_datetime", "arrival_datetime", "departure_city", "arrival_city"}
    for idx, t in enumerate(tickets, start=1):
        if not isinstance(t, dict):
            raise ValueError(f"Ticket #{idx} is not an object")
        missing = required - set(t.keys())
        if missing:
            raise ValueError(f"Ticket #{idx} missing fields: {missing}")

    # 6) insert into MySQL
    conn = pymysql.connect(
        host=db_config['host'],
        user=db_config['user'],
        password=db_config['password'],
        database=db_config['database'],
        cursorclass=pymysql.cursors.DictCursor
    )
    try:
        with conn.cursor() as cur:
            insert_sql = """
                INSERT INTO tickets
                  (id, user_id, type, ticket_number,
                   departure_datetime, arrival_datetime,
                   departure_city, arrival_city,
                   departure_code, arrival_code, seats)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """
            for t in tickets:
                ticket_id = str(uuid.uuid4())
                cur.execute(insert_sql, (
                    ticket_id,
                    user_id,
                    t["type"],
                    t["ticket_number"],
                    t["departure_datetime"],
                    t["arrival_datetime"],
                    t["departure_city"],
                    t["arrival_city"],
                    t.get("departure_code"),
                    t.get("arrival_code"),
                    t.get("seats")
                ))
        conn.commit()
    finally:
        conn.close()

    return {
        "statusCode": 200,
        "body": json.dumps({
            "message": "Inserted tickets successfully",
            "inserted": len(tickets)
        })
    }