"""Transparent grievance tracking: the citizen-facing view, its authorization
rules, and the audit trail underneath it.

These tests deliberately read the tracking payload as a *string* when checking
for leaks. A whitelist projection fails open the moment somebody adds a field
to the grievance document and forgets the view is public — checking that the
serialized response contains no officer name, no email and no internal verdict
is the only assertion that keeps holding as the document grows.
"""

import json

from fastapi.testclient import TestClient

from app.main import app
from app.config.database import (
    audit_logs_collection,
    departments_collection,
    grievances_collection,
    users_collection,
)
from app.models.department import department_document
from app.models.user import user_document
from app.utils.security import hash_password

client = TestClient(app)


def _login(email, password="Demo@123"):
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    return r.json()["data"]["access_token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _register_citizen(email):
    r = client.post("/api/auth/register", json={
        "name": "Tracking Citizen", "email": email, "password": "Demo@123",
    })
    dev_otp = r.json()["data"]["dev_otp"]
    client.post("/api/auth/verify-otp", json={"email": email, "otp_code": dev_otp})
    return _login(email)


LOCATION = {
    "latitude": 13.08,
    "longitude": 80.27,
    "address": "Test Street, Chennai",
    "district": "Chennai",
}


def _staff(code, officer_name="Priya Raman", admin_name="District Admin"):
    """A department plus one officer and one admin in it, with real names, so
    a leak of staff identity into a citizen payload is actually detectable.

    The legacy-spelling department name is deliberate: grievance routing stores
    the canonical "Sanitation & Waste Management", and staff records are
    expected to match it through the alias normalization rather than by exact
    string — the same situation the seeded demo accounts are in.
    """
    dept = "Sanitation Department"
    if not departments_collection.find_one({"code": code}):
        departments_collection.insert_one(department_document(dept, code, "Waste", ["WASTE"]))

    if not users_collection.find_one({"email": f"officer_{code.lower()}@test.com"}):
        users_collection.insert_one(user_document(
            officer_name, f"officer_{code.lower()}@test.com", hash_password("Demo@123"),
            role="officer", department=dept,
        ))
    if not users_collection.find_one({"email": f"admin_{code.lower()}@test.com"}):
        users_collection.insert_one(user_document(
            admin_name, f"admin_{code.lower()}@test.com", hash_password("Demo@123"), role="admin",
        ))

    return {
        "department": dept,
        "officer": _login(f"officer_{code.lower()}@test.com"),
        "admin": _login(f"admin_{code.lower()}@test.com"),
        "officer_name": officer_name,
        "admin_name": admin_name,
    }


def _file_grievance(token, title="Garbage not collected on Test Street",
                    description="Garbage has not been collected for four days and the bins are overflowing onto the footpath."):
    r = client.post("/api/grievances/", json={
        "title": title, "description": description, "location": LOCATION,
    }, headers=_auth(token))
    assert r.status_code == 200, r.text
    return r.json()["data"]["grievance_id"]


def _to_researched_case(code):
    """Submit -> accept -> start, returning (id, tokens, staff)."""
    staff = _staff(code)
    citizen = _register_citizen(f"track_{code.lower()}@test.com")
    gid = _file_grievance(citizen)
    client.put(f"/api/grievances/{gid}/accept", headers=_auth(staff["officer"]))
    client.put(f"/api/grievances/{gid}/start", headers=_auth(staff["officer"]))
    return gid, citizen, staff


# ---------------------------------------------------------------------------
# The tracking view itself
# ---------------------------------------------------------------------------

def test_tracking_view_carries_the_whole_citizen_story():
    staff = _staff("TRK1")
    citizen = _register_citizen("track1@test.com")
    gid = _file_grievance(citizen)

    r = client.get(f"/api/grievances/{gid}/tracking", headers=_auth(citizen))
    assert r.status_code == 200, r.text
    data = r.json()["data"]

    assert data["grievance_id"] == gid
    assert data["status"] == "DEPARTMENT_ASSIGNED"
    assert data["submitted_at"] and data["latest_update_at"]
    assert "Sanitation" in data["department"]

    # ladder: eight rungs, every one of them named and placed
    assert len(data["stages"]) == 8
    keys = [stage["key"] for stage in data["stages"]]
    assert keys == [
        "SUBMITTED", "AI_PROCESSING", "VERIFIED", "ASSIGNED",
        "IN_PROGRESS", "RESOLUTION_SUBMITTED", "CITIZEN_FEEDBACK", "RESOLVED",
    ]
    assert data["stage"]["total"] == 8
    assert data["stage"]["index"] in (2, 3)
    assert any(stage["state"] == "done" for stage in data["stages"])

    # deadline + countdown
    assert data["sla"]["due_at"]
    assert data["sla"]["clock_running"] is True
    assert data["sla"]["seconds_remaining"] > 0
    assert 0 <= data["sla"]["percent_elapsed"] <= 100

    # the reporter owns it, so the reporter's actions are offered
    assert data["permissions"]["is_owner"] is True
    assert data["permissions"]["can_withdraw"] is True

    # submission produced notifications, and the view shows them
    assert len(data["notifications"]) >= 1
    assert all(note["created_at"] for note in data["notifications"])


def test_tracking_view_exposes_no_staff_identity_or_internal_scoring():
    staff = _staff("TRK2")
    citizen = _register_citizen("track2@test.com")
    gid = _file_grievance(citizen)
    client.put(f"/api/grievances/{gid}/accept", headers=_auth(staff["officer"]))

    r = client.get(f"/api/grievances/{gid}/tracking", headers=_auth(citizen))
    payload = json.dumps(r.json())

    # named individuals, contact details and internal account ids stay staff-side
    for forbidden in (staff["officer_name"], staff["admin_name"], "citizen_id",
                      "email", "@test.com", "assigned_officer_name",
                      "authenticity", "content_fingerprint", "integrity",
                      "trust_score", "similar_cases", "duplicate_of"):
        assert forbidden not in payload, f"{forbidden} leaked into a citizen payload"

    # ... while the case still says *who owns the work* in usable terms
    data = r.json()["data"]
    assert data["officer"]["assigned"] is True
    assert "field officer" in data["officer"]["designation"]
    assert data["department"]


def test_anonymous_and_foreign_viewers_are_turned_away():
    staff = _staff("TRK3")
    citizen = _register_citizen("track3_owner@test.com")
    stranger = _register_citizen("track3_stranger@test.com")
    gid = _file_grievance(citizen)

    assert client.get(f"/api/grievances/{gid}/tracking").status_code == 401

    r = client.get(f"/api/grievances/{gid}/tracking", headers=_auth(stranger))
    assert r.status_code == 403

    # the department's officer may track it; that view is the same safe payload
    r = client.get(f"/api/grievances/{gid}/tracking", headers=_auth(staff["officer"]))
    assert r.status_code == 200
    assert r.json()["data"]["permissions"]["is_owner"] is False
    assert r.json()["data"]["permissions"]["can_withdraw"] is False


def test_full_lifecycle_walks_the_ladder_in_order():
    gid, citizen, staff = _to_researched_case("TRK4")

    r = client.get(f"/api/grievances/{gid}/tracking", headers=_auth(citizen))
    data = r.json()["data"]
    assert data["stage"]["key"] == "IN_PROGRESS"

    client.put(f"/api/grievances/{gid}/resolve", json={
        "resolution_note": "Cleared the pile and added a second weekly pickup.",
        "resolution_evidence": ["/uploads/evidence1.jpg", "/uploads/evidence2.jpg"],
    }, headers=_auth(staff["officer"]))

    r = client.get(f"/api/grievances/{gid}/tracking", headers=_auth(citizen))
    data = r.json()["data"]
    assert data["stage"]["key"] == "CITIZEN_FEEDBACK"
    assert data["resolution"]["evidence"] == ["/uploads/evidence1.jpg", "/uploads/evidence2.jpg"]
    assert data["permissions"]["can_give_feedback"] is True
    # the clock stops when the work is filed — it is no longer a race
    assert data["sla"]["clock_running"] is False

    r = client.put(f"/api/grievances/{gid}/verify", json={
        "verified": True, "feedback": "All clear, thank you.", "rating": 5,
    }, headers=_auth(citizen))
    assert r.status_code == 200
    assert r.json()["data"]["status"] == "CLOSED"

    r = client.get(f"/api/grievances/{gid}/tracking", headers=_auth(citizen))
    data = r.json()["data"]
    assert data["stage"]["key"] == "RESOLVED"
    assert data["feedback"]["rating"] == 5
    assert data["feedback"]["comment"] == "All clear, thank you."
    assert data["stages"][-1]["state"] == "done"


# ---------------------------------------------------------------------------
# Status changes: legality, authority, and the record they leave behind
# ---------------------------------------------------------------------------

def test_citizen_cannot_move_the_case_forward():
    gid, citizen, _ = _to_researched_case("TRK5")

    # a reporter cannot resolve, accept, escalate or reject their own case
    for path, body in (
        (f"/api/grievances/{gid}/resolve", {"resolution_note": "I fixed it myself"}),
        (f"/api/grievances/{gid}/escalate", None),
        (f"/api/grievances/{gid}/reject", {"reason": "I do not want this case handled"}),
    ):
        r = client.put(path, json=body or {}, headers=_auth(citizen))
        assert r.status_code == 403, (path, r.text)


def test_reject_needs_a_reason_and_is_terminal():
    staff = _staff("TRK6")
    citizen = _register_citizen("track6@test.com")
    gid = _file_grievance(citizen)

    # too short to be a real explanation
    r = client.put(f"/api/grievances/{gid}/reject", json={"reason": "no"},
                   headers=_auth(staff["officer"]))
    assert r.status_code == 422

    r = client.put(f"/api/grievances/{gid}/reject",
                   json={"reason": "The reported spot is on a private premises, outside municipal scope."},
                   headers=_auth(staff["officer"]))
    assert r.status_code == 200, r.text
    assert r.json()["data"]["status"] == "REJECTED"

    # terminal: nothing moves a rejected case, and only staff can even try
    r = client.put(f"/api/grievances/{gid}/start", headers=_auth(staff["officer"]))
    assert r.status_code == 400

    r = client.get(f"/api/grievances/{gid}/tracking", headers=_auth(citizen))
    data = r.json()["data"]
    assert data["override"]["label"] == "Rejected"
    assert "private premises" in data["rejection"]["reason"]
    assert data["stage"]["state"] == "blocked"
    assert all(stage["state"] != "current" for stage in data["stages"])


def test_officer_cannot_touch_a_case_assigned_to_someone_else():
    staff = _staff("TRK7")
    citizen = _register_citizen("track7@test.com")
    gid = _file_grievance(citizen)

    other_email = "officer_trk7b@test.com"
    if not users_collection.find_one({"email": other_email}):
        users_collection.insert_one(user_document(
            "Other Officer", other_email, hash_password("Demo@123"),
            role="officer", department=staff["department"],
        ))
    other = _login(other_email)

    client.put(f"/api/grievances/{gid}/accept", headers=_auth(staff["officer"]))

    r = client.put(f"/api/grievances/{gid}/start", headers=_auth(other))
    assert r.status_code == 403

    # and the case never moved
    assert grievances_collection.find_one({"grievance_id": gid})["status"] == "OFFICER_ACCEPTED"


def test_status_history_is_append_only_and_audited():
    gid, citizen, staff = _to_researched_case("TRK8")

    grievance = grievances_collection.find_one({"grievance_id": gid})
    statuses = [entry["status"] for entry in grievance["history"]]
    assert statuses == ["SUBMITTED", "AI_ANALYZED", "DEPARTMENT_ASSIGNED",
                        "OFFICER_ACCEPTED", "IN_PROGRESS"]
    assert all("visibility" in entry and "timestamp" in entry for entry in grievance["history"])

    audit = list(audit_logs_collection.find({"entity_id": gid, "action": "GRIEVANCE_STATUS_CHANGE"}))
    moves = {(row["details"].get("from"), row["details"].get("to")) for row in audit}
    assert ("DEPARTMENT_ASSIGNED", "OFFICER_ACCEPTED") in moves
    assert ("OFFICER_ACCEPTED", "IN_PROGRESS") in moves
    assert all(row["actor_role"] in ("officer", "system") for row in audit)


# ---------------------------------------------------------------------------
# Officer remarks and public-safe updates
# ---------------------------------------------------------------------------

def test_public_remark_reaches_the_citizen_internal_one_does_not():
    gid, citizen, staff = _to_researched_case("TRK9")

    r = client.post(f"/api/grievances/{gid}/remarks", json={
        "text": "Collection crew scheduled for Thursday morning.", "audience": "PUBLIC",
    }, headers=_auth(staff["officer"]))
    assert r.status_code == 200, r.text

    r = client.post(f"/api/grievances/{gid}/remarks", json={
        "text": "Crew short by two; contact site supervisor before Thursday.", "audience": "INTERNAL",
    }, headers=_auth(staff["officer"]))
    assert r.status_code == 200, r.text

    grievance = grievances_collection.find_one({"grievance_id": gid})
    assert len(grievance["remarks"]) == 2, "both remarks belong in the immutable record"

    r = client.get(f"/api/grievances/{gid}/tracking", headers=_auth(citizen))
    payload = json.dumps(r.json())
    remarks = r.json()["data"]["remarks"]

    assert len(remarks) == 1
    assert "Thursday morning" in remarks[0]["text"]
    assert "supervisor" not in payload
    # the citizen is told which desk spoke, never which person
    assert "Priya Raman" not in payload
    assert remarks[0]["designation"]

    # the plain grievance endpoint redacts the same way
    r = client.get(f"/api/grievances/{gid}", headers=_auth(citizen))
    assert "supervisor" not in json.dumps(r.json())

    # staff still see both
    r = client.get(f"/api/grievances/{gid}", headers=_auth(staff["admin"]))
    assert len(r.json()["data"]["remarks"]) == 2


def test_citizen_cannot_write_remarks():
    gid, citizen, _ = _to_researched_case("TRK10")

    r = client.post(f"/api/grievances/{gid}/remarks", json={"text": "My own note", "audience": "PUBLIC"},
                    headers=_auth(citizen))
    assert r.status_code == 403


def test_remark_does_not_change_status():
    gid, citizen, staff = _to_researched_case("TRK11")
    before = grievances_collection.find_one({"grievance_id": gid})["status"]

    client.post(f"/api/grievances/{gid}/remarks", json={"text": "Site visited, work pending.", "audience": "PUBLIC"},
                headers=_auth(staff["officer"]))

    assert grievances_collection.find_one({"grievance_id": gid})["status"] == before


# ---------------------------------------------------------------------------
# Feedback, rating and reopen requests
# ---------------------------------------------------------------------------

def test_rating_is_bounded_to_one_to_five():
    gid, citizen, staff = _to_researched_case("TRK12")
    client.put(f"/api/grievances/{gid}/resolve", json={"resolution_note": "Done and cleared."},
               headers=_auth(staff["officer"]))

    r = client.put(f"/api/grievances/{gid}/verify", json={"verified": True, "rating": 6},
                   headers=_auth(citizen))
    assert r.status_code == 422

    r = client.put(f"/api/grievances/{gid}/feedback", json={"rating": 4, "feedback": "Good, took a while."},
                   headers=_auth(citizen))
    assert r.status_code == 200, r.text
    assert grievances_collection.find_one({"grievance_id": gid})["citizen_rating"] == 4

    # not nothing at all, please
    r = client.put(f"/api/grievances/{gid}/feedback", json={}, headers=_auth(citizen))
    assert r.status_code == 422


def test_feedback_cannot_be_given_before_a_resolution_exists():
    staff = _staff("TRK13")
    citizen = _register_citizen("track13@test.com")
    gid = _file_grievance(citizen)

    r = client.put(f"/api/grievances/{gid}/feedback", json={"rating": 5}, headers=_auth(citizen))
    assert r.status_code == 400

    # and another citizen cannot rate it either
    stranger = _register_citizen("track13b@test.com")
    r = client.put(f"/api/grievances/{gid}/feedback", json={"rating": 1}, headers=_auth(stranger))
    assert r.status_code == 403


def test_reopen_request_is_shown_on_the_ladder_with_its_reason():
    gid, citizen, staff = _to_researched_case("TRK14")
    client.put(f"/api/grievances/{gid}/resolve", json={"resolution_note": "Cleared."},
               headers=_auth(staff["officer"]))
    client.put(f"/api/grievances/{gid}/verify", json={"verified": True, "rating": 3},
               headers=_auth(citizen))

    r = client.post(f"/api/grievances/{gid}/reopen-request",
                    json={"reason": "The bin behind the gate was never touched and is overflowing again."},
                    headers=_auth(citizen))
    assert r.status_code == 200, r.text

    r = client.get(f"/api/grievances/{gid}/tracking", headers=_auth(citizen))
    data = r.json()["data"]
    assert data["reopen"]["request_status"] == "PENDING"
    assert "overflowing again" in data["reopen"]["reason"]
    assert data["permissions"]["can_request_reopen"] is False, "one request at a time"
    assert any(entry["status"] == "CLOSED" for entry in data["timeline"])


def test_escalated_case_shows_progress_and_says_so():
    gid, citizen, staff = _to_researched_case("TRK15")

    r = client.put(f"/api/grievances/{gid}/escalate", headers=_auth(staff["officer"]))
    assert r.status_code == 200, r.text

    r = client.get(f"/api/grievances/{gid}/tracking", headers=_auth(citizen))
    data = r.json()["data"]
    assert data["status"] == "ESCALATED"
    assert data["override"]["label"] == "Escalated"
    assert data["stage"]["key"] == "IN_PROGRESS"
    assert data["stage"]["state"] == "blocked"
