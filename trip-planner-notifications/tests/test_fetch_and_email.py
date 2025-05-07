import os
# PRIME env before importing the handler
os.environ["QUEUE_URL"]    = "https://sqs.us-east-2.amazonaws.com/123456789012/test-queue"
os.environ["SENDER_EMAIL"] = "no-reply@domain.com"

import json
import boto3
import pytest
from moto import mock_aws
from fetch_and_email import app

@mock_aws
def test_handler_emails_and_deletes():
    # 1) Create a Moto SQS queue & SES
    sqs_client = boto3.client("sqs", region_name="us-east-2")
    queue_url = sqs_client.create_queue(QueueName="test-queue")["QueueUrl"]
    ses_client = boto3.client("ses", region_name="us-east-2")
    ses_client.verify_email_identity(EmailAddress=os.environ["SENDER_EMAIL"])

    # 2) Override module‐level constants & clients
    app.QUEUE_URL    = queue_url
    app.SENDER_EMAIL = os.environ["SENDER_EMAIL"]
    app.sqs          = sqs_client
    app.ses          = ses_client

    # 3) Send test message
    sqs_client.send_message(
        QueueUrl=queue_url,
        MessageBody=json.dumps({
            "email":"a@b.com",
            "start_city":"X",
            "end_city":"Y",
            "abnormal":{"weather":"Snow"},
            "timestamp":"now"
        })
    )

    # 4) Invoke handler
    result = app.handler({}, None)
    assert result["statusCode"] == 200

    # 5) Confirm queue is now empty
    resp = sqs_client.receive_message(QueueUrl=queue_url, MaxNumberOfMessages=1)
    assert "Messages" not in resp
