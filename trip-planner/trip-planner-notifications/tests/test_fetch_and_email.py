import os, json, boto3, pytest
from moto import mock_sqs, mock_ses
from fetch_and_email import app

@pytest.fixture(autouse=True)
def env_vars(monkeypatch):
    monkeypatch.setenv("QUEUE_URL","https://sqs.us-east-2.amazonaws.com/123/q")
    monkeypatch.setenv("SENDER_EMAIL","no-reply@domain.com")

@mock_sqs
@mock_ses
def test_handler_emails_and_deletes():
    sqs = boto3.client("sqs", region_name="us-east-2")
    q = sqs.create_queue(QueueName="q")["QueueUrl"]
    sqs.send_message(QueueUrl=q, MessageBody=json.dumps({
      "email":"a@b.com","start_city":"X","end_city":"Y",
      "abnormal":{"weather":"Snow"},"timestamp":"now"
    }))

    ses = boto3.client("ses", region_name="us-east-2")
    ses.verify_email_identity(EmailAddress="no-reply@domain.com")

    res = app.handler({}, None)
    assert res["statusCode"] == 200

    resp = sqs.receive_message(QueueUrl=q,MaxNumberOfMessages=1)
    assert "Messages" not in resp
