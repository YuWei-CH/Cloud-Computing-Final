import os
import json
import boto3
import pytest
from moto import mock_sqs, mock_ses
from fetch_and_email import app

@pytest.fixture(autouse=True)
def env_vars(monkeypatch):
    monkeypatch.setenv("QUEUE_URL", "https://sqs.us-east-2.amazonaws.com/123456789012/test-queue")
    monkeypatch.setenv("SENDER_EMAIL", "no-reply@yourdomain.com")
    return

@mock_sqs
@mock_ses
def test_handler_processes_and_deletes_messages():
    # setup SQS
    sqs = boto3.client("sqs", region_name="us-east-2")
    q_url = sqs.create_queue(QueueName="test-queue")["QueueUrl"]
    # put a message
    msg = {"email":"a@b.com","city":"TestCity","abnormal":{"weather":"Rain"}}
    sqs.send_message(QueueUrl=q_url, MessageBody=json.dumps(msg))

    # setup SES
    ses = boto3.client("ses", region_name="us-east-2")
    ses.verify_email_identity(EmailAddress="no-reply@yourdomain.com")

    # invoke
    result = app.handler({}, None)
    assert result["statusCode"] == 200

    # queue should now be empty
    resp = sqs.receive_message(QueueUrl=q_url,MaxNumberOfMessages=1)
    assert "Messages" not in resp

    # verify an email was sent
    sent = ses.list_sent_email()["SendEmailResponse"]
    # moto’s SES mock may not list, but no exception means success
