import os
import json
import boto3
import pytest
import requests
from moto import mock_sqs
from write_abnormal_data import app

# Fixture to set env vars
@pytest.fixture(autouse=True)
def env_vars(tmp_path, monkeypatch):
    monkeypatch.setenv("QUEUE_URL", "https://sqs.us-east-2.amazonaws.com/123456789012/test-queue")
    monkeypatch.setenv("DB_HOST", "dummy")
    monkeypatch.setenv("DB_USER", "user")
    monkeypatch.setenv("DB_PASSWORD", "pass")
    monkeypatch.setenv("DB_NAME", "db")
    monkeypatch.setenv("WEATHER_API_KEY", "weather-key")
    monkeypatch.setenv("FLIGHT_API_KEY", "flight-key")
    return

# Mock RDS via monkeypatch of pymysql.connect
class DummyCursor:
    def __enter__(self): return self
    def __exit__(self, *args): pass
    def execute(self, sql): pass
    def fetchall(self):
        return [{"TripID":"1","Email":"a@b.com","City":"TestCity","FlightNumber":"FL123"}]

class DummyConn:
    def cursor(self): return DummyCursor()
    def close(self): pass

@pytest.fixture(autouse=True)
def mock_rds(monkeypatch):
    import pymysql
    monkeypatch.setattr(pymysql, "connect", lambda **kw: DummyConn())
    return

# Mock HTTP calls
@pytest.fixture(autouse=True)
def mock_requests(monkeypatch):
    class DummyResp:
        def __init__(self, data): self._d=data
        def json(self): return self._d
    def fake_get(url, params):
        if "openweathermap" in url:
            return DummyResp({"weather":[{"main":"Rain"}]})
        else:
            return DummyResp({"status":"delayed"})
    monkeypatch.setattr(requests, "get", fake_get)
    return

@mock_sqs
def test_handler_sends_message_to_sqs():
    # setup SQS
    sqs = boto3.client("sqs", region_name="us-east-2")
    sqs.create_queue(QueueName="test-queue")
    # invoke
    result = app.handler({}, None)
    assert result["statusCode"] == 200

    # verify message in SQS
    msgs = sqs.receive_message(QueueUrl=os.environ["QUEUE_URL"],MaxNumberOfMessages=1)["Messages"]
    body = json.loads(msgs[0]["Body"])
    assert body["email"] == "a@b.com"
    assert "weather" in body["abnormal"]
    assert "flight" in body["abnormal"]
