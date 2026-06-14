from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "stemlens-lab"}

def test_home():
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]

def test_api_mission():
    payload = {
        "topic": "Projectile motion",
        "grade_band": "High school",
        "struggle": "I mix up velocity, acceleration, and gravity.",
        "learning_style": "visual"
    }
    response = client.post("/api/mission", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    assert "mission" in data
    assert "title" in data["mission"]
    assert "simulation" in data["mission"]

def test_api_feedback():
    payload = {
        "topic": "Projectile motion",
        "question": "If launch speed stays fixed, what changes when the angle increases from 20 degrees to 45 degrees?",
        "answer": "The range increases and the projectile stays in the air longer.",
        "mission": None
    }
    response = client.post("/api/feedback", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    assert "feedback" in data
    assert len(data["feedback"]) > 0
