"""End-to-end grievance lifecycle tests (citizen -> officer -> admin)."""

from fastapi.testclient import TestClient

from app.main import app
from app.config.database import departments_collection, grievances_collection, users_collection
from app.models.department import department_document
from app.models.grievance import grievance_document
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
    r = client.post("/api/auth/register", json={"name": "Grievance Citizen", "email": email, "password": "Demo@123"})
    dev_otp = r.json()["data"]["dev_otp"]
    client.post("/api/auth/verify-otp", json={"email": email, "otp_code": dev_otp})
    return _login(email)


# Location (with a valid, canonical district) is now a required field on
# grievance creation — see backend/app/schemas/grievance.py. Every test
# below that files a grievance needs to include one.
SAMPLE_LOCATION = {
    "latitude": 13.08,
    "longitude": 80.27,
    "address": "Test Street, Chennai",
    "district": "Chennai",
}


def test_citizen_can_submit_grievance():
    setup_department_and_staff("Sanitation Department", "SANA")
    token = register_citizen("gcitizen1@test.com")

    r = client.post("/api/grievances/", json={
        "title": "Garbage pile near school",
        "description": "A large pile of garbage has accumulated near the school gate for days.",
        "location": SAMPLE_LOCATION,
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
        "location": SAMPLE_LOCATION,
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
        "location": SAMPLE_LOCATION,
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
        "location": SAMPLE_LOCATION,
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
        "location": SAMPLE_LOCATION,
    }, headers=_auth_headers(citizen_token))
    grievance_id = r.json()["data"]["grievance_id"]

    r = client.get(f"/api/grievances/{grievance_id}", headers=_auth_headers(other_token))
    assert r.status_code == 403


def test_officer_queue_reflects_department_assigned_cases():
    setup_department_and_staff("Sanitation Department", "SANF")
    citizen_token = register_citizen("gcitizen7@test.com")

    client.post("/api/grievances/", json={
        "title": "Queue test grievance",
        # Text must carry real sanitation vocabulary so the pipeline routes
        # the case to this officer's department — the classifier cannot know
        # a "test" complaint belongs to Sanitation from meta-wording alone.
        "description": "Garbage not collected for four days; overflowing bins blocking the footpath.",
        "location": SAMPLE_LOCATION,
    }, headers=_auth_headers(citizen_token))

    officer_token = _login("officer_sanf@test.com")
    r = client.get("/api/grievances/queue", headers=_auth_headers(officer_token))
    assert r.status_code == 200
    assert r.json()["data"]["total"] >= 1


def test_the_citizens_own_list_filters_by_a_group_of_statuses():
    """The citizen's list offers "In progress" and "Resolved", not twelve
    internal statuses — and one bucket is several statuses at once, so the
    backend has to answer "any of these" in the same single query the page
    already makes. Priority rides along because the page filters on it too."""
    token = register_citizen("gcitizen8@test.com")
    citizen_id = users_collection.find_one({"email": "gcitizen8@test.com"})["_id"]

    for status, priority in [
        ("IN_PROGRESS", "HIGH"),
        ("CLOSED", "LOW"),
        ("REJECTED", "HIGH"),
        ("WITHDRAWN", "LOW"),
    ]:
        grievances_collection.insert_one({
            **grievance_document(
                grievance_id=f"GRPFILTER-{status}", citizen_id=citizen_id,
                title=f"A {status.title()} case",
                description="Garbage has not been collected from our street for four days.",
                location=SAMPLE_LOCATION, district="Chennai",
            ),
            "status": status,
            "priority": priority,
        })

    def listed(**params):
        r = client.get("/api/grievances/my", params=params, headers=_auth_headers(token))
        assert r.status_code == 200
        return {g["status"] for g in r.json()["data"]["items"]}

    assert listed(status="IN_PROGRESS,CLOSED") == {"IN_PROGRESS", "CLOSED"}
    # A lone value keeps its old exact-match meaning.
    assert listed(status="CLOSED") == {"CLOSED"}
    # Deleted cases stay out of the default view, and come back when asked for.
    assert "WITHDRAWN" not in listed()
    assert listed(status="WITHDRAWN") == {"WITHDRAWN"}
    assert listed(priority="HIGH") == {"IN_PROGRESS", "REJECTED"}
    assert listed(status="IN_PROGRESS,CLOSED,REJECTED", priority="HIGH") == {"IN_PROGRESS", "REJECTED"}
    # Nothing matches a status this system does not have; that is not an error.
    assert listed(status="NOT_A_STATUS") == set()