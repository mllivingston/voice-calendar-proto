from fastapi.testclient import TestClient
import os
from server.main import app

def test_list_requires_auth_when_auth_required_is_true(monkeypatch):
    monkeypatch.setenv("AUTH_REQUIRED", "true")
    monkeypatch.delenv("AUTH_BYPASS", raising=False)
    client = TestClient(app)
    r = client.get("/calendar/list")
    assert r.status_code == 401
