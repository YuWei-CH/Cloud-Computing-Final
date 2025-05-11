import json
import os
import uuid
from datetime import datetime
import base64
import mimetypes
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
- departure_datetime: ISO 8601 string in the **departure city's local timezone**
- arrival_datetime: ISO 8601 string in the **arrival city's local timezone**
- departure_city: extract only the city name. 
    • Strip any station names, codes, state info, parentheses, dashes or arrows.
    • Trim whitespace and convert to Title Case.
    e.g. input: “WASHINGTON - NEW YORK (PENN)” → output: "Washington"
- arrival_city: same rules as departure_city.
    e.g. input: “WASHINGTON - NEW YORK (PENN)” → output: "New York"
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
    # 1) Parse out the S3 Bucket name and ticket file name. 
    rec = event['Records'][0]['s3']
    bucket = rec['bucket']['name']
    file_name = rec['object']['key']
    if not bucket or not file_name:
        raise ValueError("Missing bucket name or file name. ")

    # 2) Parse out the user_email from the metadata of the S3 "head_object"
    head = s3.head_object(Bucket=bucket, Key=file_name)
    meta = head.get('Metadata', {})
    user_email = meta.get('useremail', '')
    if not user_email:
        raise ValueError(f"Missing user_email metadata on s3://{bucket}/{file_name}")

    # 3) figure out mime / extension
    ext = file_name.lower().rsplit(".",1)[-1]
    mime = mimetypes.guess_type(file_name)[0] or (
        "application/pdf" if ext=="pdf" else f"image/{ext}"
    )

    # 4) Extract file and prepare the chat “file” or “image_url” chunk
    resp = s3.get_object(Bucket=bucket, Key=file_name)
    if ext == "pdf":
        upload = openai.files.create(
            file=(file_name, resp["Body"], mime),
            purpose="user_data"
        )
        content_chunk = {
            "type": "file",
            "file": { "file_id": upload.id }
        }
    elif ext in ("png","jpg","jpeg","gif","webp"):
        img_bytes = resp["Body"].read()
        b64 = base64.b64encode(img_bytes).decode("utf-8")
        data_url = f"data:{mime};base64,{b64}"

        content_chunk = {
            "type": "image_url",
            "image_url": { "url": data_url }
        }
    else:
        raise ValueError("Unsupported file type; only PDF or common images allowed")

    # 5) call openAI API with the corresponding file
    chat_resp = openai.chat.completions.create(
        model="gpt-4.1-nano",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": [
                content_chunk,
                {"type": "text", "text": USER_PROMPT}
            ]}
        ]
    )
    raw = chat_resp.choices[0].message.content

    # 6) parse & validate JSON
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

    # 7) Fetch user_id using user_email and insert tickets into database
    conn = pymysql.connect(
        host=db_config['host'],
        user=db_config['user'],
        password=db_config['password'],
        database=db_config['database'],
        cursorclass=pymysql.cursors.DictCursor
    )
    try:
        with conn.cursor() as cur:
            # Lookup user_id by email
            cur.execute("SELECT id FROM users WHERE email = %s", (user_email,))
            row = cur.fetchone()
            if not row:
                raise ValueError(f"No user found for email {user_email}")
            user_id = row['id']

            # Insert each ticket with the fetched user_id
            insert_sql = """
                INSERT INTO tickets
                  (id, user_id, type, ticket_number,
                   departure_datetime, arrival_datetime,
                   departure_city, arrival_city,
                   departure_code, arrival_code, seats)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """
            for t in tickets:
                dep_dt = datetime.fromisoformat(t["departure_datetime"])
                arr_dt = datetime.fromisoformat(t["arrival_datetime"])
                dep_local = dep_dt.replace(tzinfo=None)
                arr_local = arr_dt.replace(tzinfo=None)
                ticket_id = str(uuid.uuid4())
                cur.execute(insert_sql, (
                    ticket_id,
                    user_id,
                    t["type"],
                    t["ticket_number"],
                    dep_local,
                    arr_local,
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
            "message": f"Inserted tickets successfully for {user_email}",
            "inserted": len(tickets)
        })
    }