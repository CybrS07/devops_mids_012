import pytest
from fastapi.testclient import TestClient

import backend.app as portal

VALID = {
    "name": "Muhammad Taha",
    "registration_number": "FA23-BAI-012",
    "assignment_title": "DevOps Lab Mid",
    "submission_url": "https://github.com/CybrS07/devops-portal",
    "class_group": "AI7",
}


@pytest.fixture
def client(tmp_path, monkeypatch):
    """A client whose data files live in a fresh temp folder, so every test
    starts empty and never touches the real backend/data files."""
    for attr in ("USERS_FILE", "ASSIGNMENTS_FILE", "SUBMISSIONS_FILE"):
        monkeypatch.setattr(portal, attr, str(tmp_path / f"{attr.lower()}.json"))
    return TestClient(portal.app)


def saved(client):
    return client.get("/api/submissions").json()


def test_valid_submission(client):
    """Complete details and a valid URL -> saved and shown in the list."""
    response = client.post("/api/submissions", json=VALID)

    assert response.status_code == 200
    assert response.json()["status"] == "success"

    submissions = saved(client)
    assert len(submissions) == 1
    assert submissions[0]["registration_number"] == VALID["registration_number"]
    assert submissions[0]["submission_url"] == VALID["submission_url"]
    assert submissions[0]["status"] == "Pending"


def test_missing_registration_number(client):
    """Missing registration number -> rejected with a validation message."""
    response = client.post("/api/submissions", json={**VALID, "registration_number": ""})

    assert response.status_code == 400
    assert "Missing registration number" in response.json()["detail"]
    assert saved(client) == []


def test_invalid_submission_url(client):
    """Invalid URL -> rejected and not saved."""
    response = client.post("/api/submissions", json={**VALID, "submission_url": "not-a-valid-url"})

    assert response.status_code == 422
    assert saved(client) == []


def test_missing_name_is_rejected(client):
    """Every required field is validated, not only the registration number."""
    response = client.post("/api/submissions", json={**VALID, "name": "   "})

    assert response.status_code == 400
    assert "Missing name" in response.json()["detail"]
    assert saved(client) == []


def test_duplicate_submission_is_rejected(client):
    """A student cannot submit the same assignment twice."""
    assert client.post("/api/submissions", json=VALID).status_code == 200
    second = client.post("/api/submissions", json=VALID)

    assert second.status_code == 400
    assert len(saved(client)) == 1