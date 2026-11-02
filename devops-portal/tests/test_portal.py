from fastapi.testclient import TestClient
from backend.app import app

client = TestClient(app)

def test_valid_submission():
    """Complete details and a valid submission URL[cite: 2]"""
    response = client.post("/api/submissions", json={
        "name": "Muhammad Taha",
        "registration_number": "FA23-BAI-012",
        "assignment_title": "DevOps Lab Mid",
        "submission_url": "https://github.com/CybrS07/devops-portal"
    })
    assert response.status_code == 200
    assert response.json()["status"] == "success"

def test_missing_registration_number():
    """Missing registration number[cite: 2]"""
    response = client.post("/api/submissions", json={
        "name": "Muhammad Taha",
        "registration_number": "",
        "assignment_title": "DevOps Lab Mid",
        "submission_url": "https://github.com/CybrS07/devops-portal"
    })
    assert response.status_code == 400
    assert "Missing registration number" in response.json()["detail"]

def test_invalid_submission_url():
    """Invalid submission URL[cite: 2]"""
    response = client.post("/api/submissions", json={
        "name": "Muhammad Taha",
        "registration_number": "FA23-BAI-012",
        "assignment_title": "DevOps Lab Mid",
        "submission_url": "not-a-valid-url"
    })
    assert response.status_code == 422 # Pydantic validation failure for HttpUrl