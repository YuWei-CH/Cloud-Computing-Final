import os
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

def lambda_handler(event, context):
    # 1) get the filename from the event
    file_name = event.get("file_name")
    if not file_name:
        raise ValueError("Must provide file_name in event")

    bucket = os.environ["BUCKET_NAME"]

    # 2) verify it exists, upload to OpenAI, and obtain the file_id
    try:
        resp = s3.get_object(Bucket=bucket, Key=file_name)
        body = resp["Body"]

        upload = openai.files.create(
            file=(file_name, body, "application/pdf"),
            purpose="user_data"
        )

        file_id = upload.id
    except s3.exceptions.NoSuchKey:
        raise FileNotFoundError(f"{file_name} not found in {bucket}")

    # 3) call openAI API with the uploaded file
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

    # return the parsed JSON as text (you can json.loads it if you want)
    return {
        "statusCode": 200,
        "body": chat_resp.choices[0].message.content
    }