"""End-to-end grievance lifecycle tests (citizen -> officer -> admin)."""

from fastapi.testclient import TestClient

from app.main import app
from app.config.database import departments_collection, users_collection
from app.models.department import department_document
from app.models.user import user_document
from app.utils.security import hash_password

client = TestClient(app)


def _login(email, password="Demo@123"):
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    return r.json()["data"]["access_token"]


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def setup_department_and_staff(dept_name="Sanitation Department", code="SAN"):
    if not departments_collection.find_one({"code": code}):
        departments_collection.insert_one(department_document(dept_name, code, "Waste", ["WASTE"]))

    if not users_collection.find_one({"email": f"officer_{code.lower()}@test.com"}):
        officer = user_document(
            f"Officer {code}", f"officer_{code.lower()}@test.com", hash_password("Demo@123"),
            role="officer", department=dept_name,
        )
        users_collection.insert_one(officer)

    if not users_collection.find_one({"email": f"admin_{code.lower()}@test.com"}):
        admin = user_document(f"Admin {code}", f"admin_{code.lower()}@test.com", hash_password("Demo@123"), role="admin")
        users_collection.insert_one(admin)


def register_citizen(email):
    client.post("/api/auth/register", json={"name": "Grievance Citizen", "email": email, "password": "Demo@123"})
    return _login(email)


def test_citizen_can_submit_grievance():
    setup_department_and_staff("Sanitation Department", "SANA")
    token = register_citizen("gcitizen1@test.com")

    r = client.post("/api/grievances/", json={
        "title": "Garbage pile near school",
        "description": "A large pile of garbage has accumulated near the school gate for days.",
    }, headers=_auth_headers(token))

    assert r.status_code == 200
    data = r.json()["data"]
    assert data["status"] == "DEPARTMENT_ASSIGNED"
    assert data["category"] == "WASTE"
    assert data["grievance_id"].startswith("CIV-")


def test_full_lifecycle_citizen_officer_verification():
    setup_department_and_staff("Sanitation Department", "SANB")
    citizen_token = register_citizen("gcitizen2@test.com")

    r = client.post("/api/grievances/", json={
        "title": "Overflowing bins on main road",
        "description": "Bins near the main road are overflowing and have not been cleared in over a week.",
    }, headers=_auth_headers(citizen_token))
    grievance_id = r.json()["data"]["grievance_id"]

    officer_token = _login("officer_sanb@test.com")
    officer_headers = _auth_headers(officer_token)

    r = client.put(f"/api/grievances/{grievance_id}/accept", headers=officer_headers)
    assert r.status_code == 200
    assert r.json()["data"]["status"] == "OFFICER_ACCEPTED"

    r = client.put(f"/api/grievances/{grievance_id}/start", headers=officer_headers)
    assert r.json()["data"]["status"] == "IN_PROGRESS"

    r = client.put(f"/api/grievances/{grievance_id}/resolve", json={
        "resolution_note": "Cleared and increased pickup frequency.",
    }, headers=officer_headers)
    assert r.json()["data"]["status"] == "CITIZEN_VERIFICATION"

    r = client.put(f"/api/grievances/{grievance_id}/verify", json={
        "verified": True, "feedback": "Thanks, all clean now.",
    }, headers=_auth_headers(citizen_token))
    assert r.json()["data"]["status"] == "CLOSED"


def test_reopen_sends_case_back_for_retriage():
    setup_department_and_staff("Sanitation Department", "SANC")
    citizen_token = register_citizen("gcitizen3@test.com")

    r = client.post("/api/grievances/", json={
        "title": "Waste not cleared near park",
        "description": "Waste collection has been missed near the community park entrance repeatedly.",
    }, headers=_auth_headers(citizen_token))
    grievance_id = r.json()["data"]["grievance_id"]

    officer_token = _login("officer_sanc@test.com")
    officer_headers = _auth_headers(officer_token)
    client.put(f"/api/grievances/{grievance_id}/accept", headers=officer_headers)
    client.put(f"/api/grievances/{grievance_id}/start", headers=officer_headers)
    client.put(f"/api/grievances/{grievance_id}/resolve", json={
        "resolution_note": "Cleared.",
    }, headers=officer_headers)

    r = client.put(f"/api/grievances/{grievance_id}/verify", json={
        "verified": False, "feedback": "Still not cleared.",
    }, headers=_auth_headers(citizen_token))
    assert r.json()["data"]["status"] == "REOPENED" or r.json()["data"]["status"] == "DEPARTMENT_ASSIGNED"
    assert r.json()["data"]["reopen_count"] == 1


def test_invalid_status_transition_rejected():
    setup_department_and_staff("Sanitation Department", "SAND")
    citizen_token = register_citizen("gcitizen4@test.com")

    r = client.post("/api/grievances/", json={
        "title": "Broken bin lid",
        "description": "A community waste bin has a broken lid attracting pests near the residential block.",
    }, headers=_auth_headers(citizen_token))
    grievance_id = r.json()["data"]["grievance_id"]

    officer_token = _login("officer_sand@test.com")
    # trying to resolve before accepting/starting should fail (invalid transition)
    r = client.put(f"/api/grievances/{grievance_id}/resolve", json={
        "resolution_note": "Skipping ahead.",
    }, headers=_auth_headers(officer_token))
    assert r.status_code == 400


def test_citizen_cannot_view_others_grievance():
    setup_department_and_staff("Sanitation Department", "SANE")
    citizen_token = register_citizen("gcitizen5@test.com")
    other_token = register_citizen("gcitizen6@test.com")

    r = client.post("/api/grievances/", json={
        "title": "Private grievance test",
        "description": "This grievance should only be visible to the citizen who filed it.",
    }, headers=_auth_headers(citizen_token))
    grievance_id = r.json()["data"]["grievance_id"]

    r = client.get(f"/api/grievances/{grievance_id}", headers=_auth_headers(other_token))
    assert r.status_code == 403


def test_officer_queue_reflects_department_assigned_cases():
    setup_department_and_staff("Sanitation Department", "SANF")
    citizen_token = register_citizen("gcitizen7@test.com")

    client.post("/api/grievances/", json={
        "title": "Queue test grievance",
        "description": "Testing that newly submitted grievances appear in the officer priority queue.",
    }, headers=_auth_headers(citizen_token))

    officer_token = _login("officer_sanf@test.com")
    r = client.get("/api/grievances/queue", headers=_auth_headers(officer_token))
    assert r.status_code == 200
    assert r.json()["data"]["total"] >= 1
