import os, json, boto3, pytest, requests
from moto import mock_sqs
from write_abnormal_data import app

@pytest.fixture(autouse=True)
def env_vars(monkeypatch):
    monkeypatch.setenv("QUEUE_URL", "https://sqs.us-east-2.amazonaws.com/123/q")
    monkeypatch.setenv("DB_HOST", "dummy")
    monkeypatch.setenv("DB_USER", "u")
    monkeypatch.setenv("DB_PASSWORD", "p")
    monkeypatch.setenv("DB_NAME", "db")
    monkeypatch.setenv("WEATHER_API_KEY", "wkey")
    monkeypatch.setenv("FLIGHT_API_KEY", "fkey")

class DummyCursor:
    def __enter__(self): return self
    def __exit__(self,*a): pass
    def execute(self, sql, *args): pass
    def fetchall(self):
        return [{"trip_id":"t1","user_id":"u1","email":"e@x.com","start_city":"A","end_city":"B"}]

class DummyConn:
    def cursor(self): return DummyCursor()
    def close(self): pass

@pytest.fixture(autouse=True)
def mock_db(monkeypatch):
    import pymysql
    monkeypatch.setattr(pymysql, "connect", lambda **kw: DummyConn())

@pytest.fixture(autouse=True)
def mock_requests(monkeypatch):
    class R: 
        def __init__(self,d): self._d=d
        def json(self): return self._d
    def fake_get(url, params):
        if "openweathermap" in url:
            return R({"weather":[{"main":"Rain"}]})
        return R({"data":[{"flight_status":"delayed"}]})
    monkeypatch.setattr(requests, "get", fake_get)

@mock_sqs
def test_handler_sends_to_sqs():
    sqs = boto3.client("sqs", region_name="us-east-2")
    q = sqs.create_queue(QueueName="q")["QueueUrl"]
    os.environ["QUEUE_URL"] = q

    res = app.handler({}, None)
    assert res["statusCode"] == 200

    msgs = sqs.receive_message(QueueUrl=q,MaxNumberOfMessages=1)["Messages"]
    body = json.loads(msgs[0]["Body"])
    assert body["abnormal"]["weather"] == "Rain"
    assert any(f["status"]=="delayed" for f in body["abnormal"]["flight"])
