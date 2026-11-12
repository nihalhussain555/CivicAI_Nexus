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
    notifications_collection,
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


def test_the_reporter_is_told_who_has_the_case_and_nothing_beyond_that():
    staff = _staff("TRK2")
    citizen = _register_citizen("track2@test.com")
    gid = _file_grievance(citizen)
    client.put(f"/api/grievances/{gid}/accept", headers=_auth(staff["officer"]))

    officer_id = str(users_collection.find_one(
        {"email": "officer_trk2@test.com"}, {"_id": 1}
    )["_id"])

    r = client.get(f"/api/grievances/{gid}/tracking", headers=_auth(citizen))
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    payload = json.dumps(r.json())

    # Accountability: the person working the file is named to the person who
    # reported the problem, alongside the desk and district they belong to.
    assert data["officer"]["assigned"] is True
    assert data["officer"]["name"] == staff["officer_name"]
    assert "field officer" in data["officer"]["designation"]
    assert data["department"]

    # ... and naming them is where it stops. No account id to look them up by,
    # no other staff member's name, and none of the staff-side scoring that
    # decides how a report is treated.
    for forbidden in (officer_id, staff["admin_name"], "citizen_id",
                      "email", "@test.com", "assigned_officer", "assigned_by",
                      "authenticity", "content_fingerprint", "integrity",
                      "trust_score", "similar_cases", "duplicate_of"):
        assert forbidden not in payload, f"{forbidden} leaked into a citizen payload"


def test_the_case_file_names_the_officer_without_their_account():
    """The legacy endpoints the case file reads from redact by a denylist, so
    the officer rule has to hold there exactly as it does in the tracking view.
    """
    staff = _staff("TRK2B")
    citizen = _register_citizen("track2b@test.com")
    gid = _file_grievance(citizen)
    client.put(f"/api/grievances/{gid}/accept", headers=_auth(staff["officer"]))

    officer_id = str(users_collection.find_one(
        {"email": "officer_trk2b@test.com"}, {"_id": 1}
    )["_id"])

    headers = _auth(citizen)
    detail = client.get(f"/api/grievances/{gid}", headers=headers).json()["data"]
    assert detail["assigned_officer_name"] == staff["officer_name"]

    # The id is replaced by the yes/no the delete gate actually needs.
    assert "assigned_officer" not in detail
    assert "assigned_by" not in detail
    assert detail["has_assigned_officer"] is True

    listed = client.get("/api/grievances/my", headers=headers).json()["data"]
    rows = listed.get("items") if isinstance(listed, dict) else listed
    mine = next(row for row in rows if row["grievance_id"] == gid)
    assert mine["assigned_officer_name"] == staff["officer_name"]
    assert "assigned_officer" not in mine
    assert officer_id not in json.dumps(mine)

    # Staff keep the id — it is how their own queue says "this one is yours".
    staff_view = client.get(f"/api/grievances/{gid}",
                            headers=_auth(staff["officer"])).json()["data"]
    assert str(staff_view["assigned_officer"]) == officer_id


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
    # A remark is attributed to the desk that wrote it — the author of a note is
    # not necessarily the officer named on the case, and the person who filed
    # the report needs to know who owns the work, not who was on shift.
    assert remarks[0]["designation"]
    assert "Priya Raman" not in remarks[0]["designation"]
    # The assigned officer *is* named, in their own block (see
    # test_the_reporter_is_told_who_has_the_case_and_nothing_beyond_that).
    assert r.json()["data"]["officer"]["name"] == "Priya Raman"

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
# Feedback, one rating per repair, and who may reopen a closed case
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


def test_one_rating_per_repair_that_locks_with_the_confirmation():
    gid, citizen, staff = _to_researched_case("TRK16")
    client.put(f"/api/grievances/{gid}/resolve", json={"resolution_note": "Cleared."},
               headers=_auth(staff["officer"]))

    # While the fix is still in front of them the answer is editable, because
    # nothing about this repair is final yet.
    r = client.put(f"/api/grievances/{gid}/feedback", json={"rating": 4}, headers=_auth(citizen))
    assert r.status_code == 200, r.text
    assert grievances_collection.find_one({"grievance_id": gid})["citizen_rating"] == 4

    # Confirming the fix is what files it.
    r = client.put(f"/api/grievances/{gid}/verify",
                   json={"verified": True, "feedback": "All clear, thank you.", "rating": 5},
                   headers=_auth(citizen))
    assert r.status_code == 200, r.text

    r = client.get(f"/api/grievances/{gid}/tracking", headers=_auth(citizen))
    data = r.json()["data"]
    assert data["feedback"]["rating"] == 5
    assert data["feedback"]["can_rate"] is False
    assert data["permissions"]["can_give_feedback"] is False

    # A change of mind five days later is not a second rating.
    r = client.put(f"/api/grievances/{gid}/feedback", json={"rating": 1}, headers=_auth(citizen))
    assert r.status_code == 400, r.text
    grievance = grievances_collection.find_one({"grievance_id": gid})
    assert grievance["citizen_rating"] == 5
    assert grievance["citizen_feedback"] == "All clear, thank you."

    # The department reworks the job, and that next repair is rateable again.
    r = client.put(f"/api/grievances/{gid}/reopen",
                   json={"reason": "A second pickup was missed on the same street."},
                   headers=_auth(staff["officer"]))
    assert r.status_code == 200, r.text
    client.put(f"/api/grievances/{gid}/accept", headers=_auth(staff["officer"]))
    client.put(f"/api/grievances/{gid}/start", headers=_auth(staff["officer"]))
    client.put(f"/api/grievances/{gid}/resolve", json={"resolution_note": "Both pickups done."},
               headers=_auth(staff["officer"]))

    r = client.get(f"/api/grievances/{gid}/tracking", headers=_auth(citizen))
    data = r.json()["data"]
    assert data["status"] == "CITIZEN_VERIFICATION"
    assert data["feedback"]["can_rate"] is True
    assert data["permissions"]["can_give_feedback"] is True

    r = client.put(f"/api/grievances/{gid}/feedback", json={"rating": 2}, headers=_auth(citizen))
    assert r.status_code == 200, r.text

    # The round it replaced is not lost — it is part of the case record.
    grievance = grievances_collection.find_one({"grievance_id": gid})
    messages = " | ".join(entry["message"] for entry in grievance["history"])
    assert "rated this fix 4/5" in messages
    assert "rated it 5/5" in messages
    assert "rated this fix 2/5" in messages
    assert grievance["citizen_rating"] == 2

    # And confirming without an answer of its own keeps the one on file.
    r = client.put(f"/api/grievances/{gid}/verify", json={"verified": True}, headers=_auth(citizen))
    assert r.status_code == 200, r.text
    grievance = grievances_collection.find_one({"grievance_id": gid})
    assert grievance["citizen_rating"] == 2


def test_reopening_a_confirmed_case_is_the_departments_call_alone():
    gid, citizen, staff = _to_researched_case("TRK17")
    client.put(f"/api/grievances/{gid}/resolve", json={"resolution_note": "Cleared."},
               headers=_auth(staff["officer"]))
    client.put(f"/api/grievances/{gid}/verify", json={"verified": True, "rating": 3},
               headers=_auth(citizen))

    # The citizen has no reopen action left to them, at either door.
    r = client.put(f"/api/grievances/{gid}/reopen",
                   json={"reason": "It is overflowing again."}, headers=_auth(citizen))
    assert r.status_code == 403, r.text

    r = client.put(f"/api/grievances/{gid}/verify",
                   json={"verified": False, "feedback": "Not actually fixed."},
                   headers=_auth(citizen))
    assert r.status_code == 403, r.text
    assert r.json()["error"]["message"] == "A confirmed resolution can only be reopened by the department"
    assert grievances_collection.find_one({"grievance_id": gid})["status"] == "CLOSED"

    # A reopen needs a reason the reporter can act on.
    r = client.put(f"/api/grievances/{gid}/reopen", json={"reason": "too short"},
                   headers=_auth(staff["admin"]))
    assert r.status_code == 422

    r = client.put(f"/api/grievances/{gid}/reopen",
                   json={"reason": "The crew missed the second bin; a fresh pickup is booked."},
                   headers=_auth(staff["admin"]))
    assert r.status_code == 200, r.text

    grievance = grievances_collection.find_one({"grievance_id": gid})
    assert grievance["status"] == "DEPARTMENT_ASSIGNED"
    assert grievance["reopen_count"] == 1
    assert grievance["assigned_officer"] is None
    assert grievance["citizen_verified"] is None
    assert "REOPENED" in [entry["status"] for entry in grievance["history"]]

    assert len(list(audit_logs_collection.find(
        {"entity_id": gid, "action": "GRIEVANCE_REOPENED"}
    ))) == 1
    notes = list(notifications_collection.find({"related_grievance_id": gid}))
    assert any("reopened" in f"{n.get('title')} {n.get('message')}".lower() for n in notes)

    # What the reporter is told: the case is moving again, and why. Who in the
    # office pressed the button stays on the staff side of the payload.
    r = client.get(f"/api/grievances/{gid}/tracking", headers=_auth(citizen))
    payload = json.dumps(r.json())
    data = r.json()["data"]
    assert data["reopen"]["count"] == 1
    assert "fresh pickup is booked" in data["reopen"]["reason"]
    assert "can_request_reopen" not in data["permissions"]
    assert data["officer"]["assigned"] is False
    assert staff["admin_name"] not in payload
    assert "reopened_by" not in payload


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
