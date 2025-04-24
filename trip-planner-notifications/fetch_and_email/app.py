import os
import json
import boto3

sqs   = boto3.client('sqs')
ses   = boto3.client('ses')

QUEUE_URL    = os.environ['QUEUE_URL']
SENDER_EMAIL = os.environ['SENDER_EMAIL']

def handler(event, context):
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
            data = json.loads(m['Body'])
            subject = f"🚨 Trip Alert for {data['city']}"
            html = (
                "<h3>Trip Alert</h3>"
                "<ul>"
                + "".join(f"<li><b>{k}:</b> {v}</li>"
                          for k, v in data['abnormal'].items())
                + "</ul>"
            )
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
