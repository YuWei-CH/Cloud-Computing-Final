import os
import json
import boto3
from datetime import datetime
import logging

logger = logging.getLogger()
logger.setLevel(logging.DEBUG)

sqs          = boto3.client('sqs')
ses          = boto3.client('ses')

QUEUE_URL    = os.environ['QUEUE_URL']
SENDER_EMAIL = os.environ['SENDER_EMAIL']

def handler(event, context):
    # pull all waiting messages
    while True:
        resp = sqs.receive_message(
            QueueUrl=QUEUE_URL,
            MaxNumberOfMessages=5,
            WaitTimeSeconds=1
        )
        msgs = resp.get('Messages', [])
        if not msgs:
            break

        for m in msgs:
            logger.debug(f"Polling SQS queue {QUEUE_URL} …")
            logger.debug(f"Received messages: {msgs}")
            print("📥 received SQS message:", m['Body'])
            data = json.loads(m['Body'])
            print("✉️  sending email to:", data['email'])
            subject = f"🚨 Trip Alert for {data['end_city']}"
            html = (
                "<h3>Trip Alert</h3>"
                "<ul>"
                + "".join(f"<li><b>{k}:</b> {v}</li>"
                          for k, v in data['abnormal'].items())
                + "</ul>"
            )
            logger.debug(f"Sending email: from={SENDER_EMAIL} to={data['email']} subject={subject!r}")
            ses.send_email(
                Source=SENDER_EMAIL,
                Destination={'ToAddresses': [data['email']]},
                Message={
                  'Subject': {'Data': subject},
                  'Body': {'Html': {'Data': html}}
                }
            )
            sqs.delete_message(
                QueueUrl=QUEUE_URL,
                ReceiptHandle=m['ReceiptHandle']
            )

    return {'statusCode': 200}
