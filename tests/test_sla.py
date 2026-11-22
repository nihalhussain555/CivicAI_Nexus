"""Automated SLA management: deadlines, monitoring sweep, escalation
idempotency, reopen/priority policies, reporting accuracy and configuration
authorization.

The scheduler is deliberately tested through ``escalation_service.sweep`` and
``sla_scheduler.run_once`` with an injected ``now`` — time is the only input
that drives every threshold, and being able to move the clock is what makes
"warning fires at 75%" a real assertion instead of a sleep-based flake.
"""

from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.config.database import (
    create_indexes,
    grievances_collection,
    notifications_collection,
    sla_config_collection,
    sla_logs_collection,
    sla_state_collection,
    users_collection,
)
from app.models.grievance import grievance_document
from app.models.user import user_document
from app.services import escalation_service, sla_service
from app.jobs import sla_scheduler
from app.utils.security import hash_password

client = TestClient(app)


def _utcnow():
    """BSON dates are millisecond-exact; comparing test expectations against
    stored values needs the same truncation."""
    return datetime.utcnow().replace(microsecond=0)


@pytest.fixture(scope="module", autouse=True)
def _indexes():
    # TestClient(app) without a context manager never runs the lifespan, so
    # the unique index that powers escalation idempotency must be created
    # explicitly for this module.
    create_indexes()


# ---------------------------------------------------------------------------
# Fixtures / helpers
# ---------------------------------------------------------------------------

DEPT = "Sanitation & Waste Management"


@pytest.fixture(autouse=True)
def _clean_sla_state():
    sla_config_collection.delete_many({})
    yield
    sla_config_collection.delete_many({})


def _user(email, role, name=None, department=None, district=None):
    existing = users_collection.find_one({"email": email})
    if existing:
        return existing
    doc = user_document(name or f"{role.title()} {email.split('@')[0]}",
                        email, hash_password("Demo@123"),
                        role=role, department=department, district=district)
    # Citizens are inserted pre-verified: the register/OTP flow belongs to
    # auth's own tests; SLA tests need logins, not signup ceremony.
    doc["email_verified"] = True
    users_collection.insert_one(doc)
    return doc


def _login(email, password="Demo@123"):
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['data']['access_token']}"}


@pytest.fixture()
def actors():
    officer = users_collection.find_one({"role": "officer", "name": "Officer Anand"}) \
        or _user("sla_officer@test.com", "officer", name="Officer Anand", department=DEPT)
    super_admin = _user("sla_super@test.com", "admin", name="Super Admin")
    district_admin = _user("sla_district_admin@test.com", "admin", name="Chennai Admin",
                           district="Chennai")
    other_admin = _user("sla_other_admin@test.com", "admin", name="Other Admin",
                        district="Mumbai")
    return {"officer": officer, "super_admin": super_admin,
            "district_admin": district_admin, "other_admin": other_admin}


_counter = 0


def _make_case(**overrides):
    """Insert a grievance with a fully initialized SLA block. Pass
    ``started_at`` to anchor the clock in the past; ``sla_service`` computes
    the deadline from the live config exactly as the scheduler would."""
    global _counter
    _counter += 1
    gid = f"CIV-TEST-SLA{_counter:04d}"
    now = _utcnow().replace(microsecond=0)  # BSON date math is ms-exact
    started = overrides.pop("started_at", now - overrides.pop("age", timedelta(0)))
    if isinstance(started, datetime):
        started = started.replace(microsecond=0)

    doc = grievance_document(
        grievance_id=gid,
        citizen_id=overrides.pop("citizen_id", None),
        title=overrides.pop("title", "Garbage not collected"),
        description=overrides.pop("description", "Bins overflowing on the street"),
        district=overrides.pop("district", "Chennai"),
    )
    doc.update({
        "department": DEPT,
        "status": "IN_PROGRESS",
        "created_at": started,
        "updated_at": now,
    })
    doc.update(overrides)
    sla_service.initialize_grievance_sla(doc, start=started)
    # initialize stamps created_at-derived start only when asked; keep ours.
    doc["sla_start_at"] = started
    grievances_collection.insert_one(doc)
    return grievances_collection.find_one({"grievance_id": gid})


def _levels_for(gid, cycle=None):
    q = {"grievance_id": gid}
    if cycle is not None:
        q["cycle"] = cycle
    return {row["level"] for row in sla_logs_collection.find(q)}


def _sweep(now=None):
    return escalation_service.sweep(now=now)


# ---------------------------------------------------------------------------
# 1-3: Deadline assignment per priority (168 / 72 / 24 / 6 hours)
# ---------------------------------------------------------------------------

def test_deadline_matches_priority_durations_from_defaults():
    now = _utcnow()
    for priority, hours in (("LOW", 168), ("MEDIUM", 72), ("HIGH", 24), ("CRITICAL", 6)):
        case = _make_case(priority=priority, started_at=now)
        assert case["sla_hours"] == hours, priority
        assert case["sla_due_at"] == now + timedelta(hours=hours)
        assert case["sla_status"] == "ON_TRACK"
        assert case["sla_priority_basis"] == priority


def test_new_grievance_via_api_gets_full_sla_block():
    citizen = _user("sla_citizen_create@test.com", "citizen")
    token = _login("sla_citizen_create@test.com")
    r = client.post("/api/grievances/", json={
        "title": "Overflowing garbage near bus stop",
        "description": "Garbage has not been collected for a week near the bus stop.",
        "location": {"latitude": 13.08, "longitude": 80.27,
                     "address": "Test Street", "district": "Chennai"},
    }, headers=token)
    assert r.status_code == 200, r.text
    gid = r.json()["data"]["grievance_id"]

    doc = grievances_collection.find_one({"grievance_id": gid})
    assert doc["sla_start_at"] is not None
    assert doc["sla_due_at"] > doc["sla_start_at"]
    expected_hours = sla_service.effective_hours(sla_service.get_config(), doc["priority"])
    assert doc["sla_due_at"] - doc["sla_start_at"] == timedelta(hours=expected_hours)
    assert doc["sla_status"] == "ON_TRACK"


def test_admin_configured_duration_applies_to_new_case():
    config = sla_service.get_config()
    config["priority_hours"]["LOW"] = 12
    sla_service.save_config(config, {"_id": None, "role": "admin", "name": "Test"})

    now = _utcnow()
    case = _make_case(priority="LOW", started_at=now)
    assert case["sla_due_at"] == now + timedelta(hours=12)


# ---------------------------------------------------------------------------
# 4-7: Threshold firing at 75 / 90 / 100 / 125 %
# ---------------------------------------------------------------------------

def _case_at_elapsed(priority, fraction, **kw):
    hours = sla_service.effective_hours(sla_service.get_config(), priority)
    age = timedelta(hours=hours * fraction)
    return _make_case(priority=priority, started_at=_utcnow() - age, **kw)


def test_warning_fires_at_75_percent_and_notifies_officer(actors):
    case = _case_at_elapsed("LOW", 0.80)
    grievances_collection.update_one(
        {"grievance_id": case["grievance_id"]},
        {"$set": {"assigned_officer": actors["officer"]["_id"]}})

    _sweep()

    levels = _levels_for(case["grievance_id"])
    assert "WARNING" in levels
    assert "URGENT" not in levels and "BREACH" not in levels
    refreshed = grievances_collection.find_one({"grievance_id": case["grievance_id"]})
    assert refreshed["sla_status"] == "WARNING"

    n = notifications_collection.find_one({
        "user_id": actors["officer"]["_id"],
        "related_grievance_id": case["grievance_id"],
        "type": "SLA_RISK",
    })
    assert n is not None


def test_urgent_fires_at_90_percent_and_notifies_admins(actors):
    case = _case_at_elapsed("MEDIUM", 0.95)
    _sweep()
    levels = _levels_for(case["grievance_id"])
    assert {"WARNING", "URGENT"} <= levels  # earlier thresholds backfill
    assert "BREACH" not in levels

    # Urgent pages district admins (the supervisor tier).
    assert notifications_collection.find_one({
        "user_id": actors["district_admin"]["_id"],
        "related_grievance_id": case["grievance_id"]}) is not None
    # ...and never an admin from another district.
    assert notifications_collection.find_one({
        "user_id": actors["other_admin"]["_id"],
        "related_grievance_id": case["grievance_id"]}) is None


def test_breach_recorded_at_100_percent(actors):
    case = _case_at_elapsed("HIGH", 1.10)
    _sweep()
    levels = _levels_for(case["grievance_id"])
    assert "BREACH" in levels and "SENIOR_ESCALATION" not in levels

    refreshed = grievances_collection.find_one({"grievance_id": case["grievance_id"]})
    assert refreshed["sla_status"] == "BREACHED"
    assert refreshed["sla_breached_at"] == case["sla_due_at"]
    # Breach pages super admins too.
    assert notifications_collection.find_one({
        "user_id": actors["super_admin"]["_id"],
        "related_grievance_id": case["grievance_id"]}) is not None


def test_senior_escalation_at_125_percent(actors):
    case = _case_at_elapsed("MEDIUM", 1.30)
    _sweep()
    assert "SENIOR_ESCALATION" in _levels_for(case["grievance_id"])
    refreshed = grievances_collection.find_one({"grievance_id": case["grievance_id"]})
    assert refreshed["sla_status"] == "ESCALATED"
    # Escalation must never silently re-assign the case.
    assert refreshed["assigned_officer"] == case.get("assigned_officer")


# ---------------------------------------------------------------------------
# 8: Resolved cases stop monitoring
# ---------------------------------------------------------------------------

def test_resolved_within_sla_settles_as_met():
    now = _utcnow()
    case = _case_at_elapsed("LOW", 0.50)
    grievances_collection.update_one(
        {"grievance_id": case["grievance_id"]},
        {"$set": {"status": "RESOLUTION_SUBMITTED", "resolved_at": now}})

    _sweep()
    levels = _levels_for(case["grievance_id"])
    assert "RESOLVED_MET" in levels
    refreshed = grievances_collection.find_one({"grievance_id": case["grievance_id"]})
    assert refreshed["sla_status"] == "RESOLVED"

    # Further sweeps change nothing — the case is out of the active set.
    _sweep()
    assert _levels_for(case["grievance_id"]) == levels


def test_resolved_after_deadline_settles_as_missed():
    case = _case_at_elapsed("CRITICAL", 2.0)
    grievances_collection.update_one(
        {"grievance_id": case["grievance_id"]},
        {"$set": {"status": "CLOSED",
                  "resolved_at": case["sla_due_at"] + timedelta(hours=3)}})
    _sweep()
    assert "RESOLVED_MISSED" in _levels_for(case["grievance_id"])


def test_rejected_case_closes_the_clock_as_void():
    case = _case_at_elapsed("LOW", 0.10)
    grievances_collection.update_one(
        {"grievance_id": case["grievance_id"]},
        {"$set": {"status": "REJECTED", "rejected_at": _utcnow()}})
    _sweep()
    assert "VOID" in _levels_for(case["grievance_id"])
    refreshed = grievances_collection.find_one({"grievance_id": case["grievance_id"]})
    assert refreshed["sla_status"] == "RESOLVED"


# ---------------------------------------------------------------------------
# 9: Duplicate prevention (idempotency)
# ---------------------------------------------------------------------------

def test_sweeps_do_not_duplicate_events_or_notifications():
    case = _case_at_elapsed("HIGH", 1.30)
    _sweep()
    first_logs = sla_logs_collection.count_documents({"grievance_id": case["grievance_id"]})
    first_notifs = notifications_collection.count_documents(
        {"related_grievance_id": case["grievance_id"]})

    _sweep()
    _sweep()

    assert sla_logs_collection.count_documents(
        {"grievance_id": case["grievance_id"]}) == first_logs
    assert notifications_collection.count_documents(
        {"related_grievance_id": case["grievance_id"]}) == first_notifs


# ---------------------------------------------------------------------------
# 10: Scheduler resume / lease behaviour across restarts
# ---------------------------------------------------------------------------

def test_run_once_sweeps_and_records_health():
    case = _case_at_elapsed("MEDIUM", 0.80)
    summary = sla_scheduler.run_once()
    assert summary is not None and summary["processed"] >= 1
    assert "WARNING" in _levels_for(case["grievance_id"])

    health = sla_scheduler.scheduler_health()
    assert health["last_run_at"] is not None
    assert health["run_count"] >= 1
    assert health["lease_holder"] == sla_scheduler.INSTANCE_ID


def test_expired_foreign_lease_is_taken_over():
    # Simulate a crashed instance that died holding the lease.
    from app.jobs.sla_scheduler import STATE_ID
    sla_state_collection.update_one(
        {"_id": STATE_ID},
        {"$set": {"lock_owner": "dead-host:1:aaaa",
                  "lock_expires_at": _utcnow() - timedelta(seconds=5)}},
        upsert=True,
    )
    assert sla_scheduler.acquire_lease(60) is True
    doc = sla_state_collection.find_one({"_id": STATE_ID})
    assert doc["lock_owner"] == sla_scheduler.INSTANCE_ID


def test_live_foreign_lease_blocks_this_instance():
    from app.jobs.sla_scheduler import STATE_ID
    original = sla_scheduler.INSTANCE_ID
    try:
        sla_scheduler.INSTANCE_ID = "us:host"
        sla_state_collection.update_one(
            {"_id": STATE_ID},
            {"$set": {"lock_owner": "other:host",
                      "lock_expires_at": _utcnow() + timedelta(minutes=5)}},
            upsert=True,
        )
        assert sla_scheduler.acquire_lease(60) is False
        assert sla_scheduler.run_once() is None
    finally:
        sla_scheduler.INSTANCE_ID = original
        sla_state_collection.delete_many({})


def test_sweep_backfills_cases_created_before_sla_tracking():
    legacy = grievance_document(grievance_id="CIV-LEGACY-1", citizen_id=None,
                                title="Old case", description="Old description",
                                district="Chennai")
    legacy.update({"status": "IN_PROGRESS", "priority": "MEDIUM",
                   "created_at": _utcnow() - timedelta(hours=100)})
    grievances_collection.insert_one(legacy)

    _sweep()
    refreshed = grievances_collection.find_one({"grievance_id": "CIV-LEGACY-1"})
    assert refreshed["sla_start_at"] is not None
    assert refreshed["sla_due_at"] is not None
    # 100h elapsed of a 72h window -> breach territory, fully processed.
    assert {"WARNING", "URGENT", "BREACH"} <= _levels_for("CIV-LEGACY-1")


# ---------------------------------------------------------------------------
# 13: Priority-change recalculation policy
# ---------------------------------------------------------------------------

def test_priority_change_recalculates_from_original_start():
    now = _utcnow()
    case = _make_case(priority="HIGH", started_at=now)  # due = now+24h
    grievances_collection.update_one(
        {"grievance_id": case["grievance_id"]}, {"$set": {"priority": "CRITICAL"}})

    later = now + timedelta(hours=10)
    escalation_service.sweep(now=later)

    refreshed = grievances_collection.find_one({"grievance_id": case["grievance_id"]})
    # RECALCULATE: 6h window measured from the ORIGINAL start, not from now.
    assert refreshed["sla_due_at"] == now + timedelta(hours=6)
    assert refreshed["sla_priority_basis"] == "CRITICAL"
    assert "PRIORITY_RECALC" in _levels_for(case["grievance_id"])


def test_priority_change_keeps_deadline_under_keep_policy(actors):
    config = sla_service.get_config()
    config["priority_change_policy"] = "KEEP"
    sla_service.save_config(config, actors["super_admin"])

    now = _utcnow()
    case = _make_case(priority="HIGH", started_at=now)
    grievances_collection.update_one(
        {"grievance_id": case["grievance_id"]}, {"$set": {"priority": "CRITICAL"}})
    _sweep()

    refreshed = grievances_collection.find_one({"grievance_id": case["grievance_id"]})
    assert refreshed["sla_due_at"] == now + timedelta(hours=24)
    assert refreshed["sla_priority_basis"] == "CRITICAL"


# ---------------------------------------------------------------------------
# 14: Reopen policy restarts the cycle
# ---------------------------------------------------------------------------

def test_reopen_starts_a_new_sla_cycle():
    case = _make_case(priority="MEDIUM", started_at=_utcnow() - timedelta(hours=100))
    grievances_collection.update_one(
        {"grievance_id": case["grievance_id"]},
        {"$set": {"status": "DEPARTMENT_ASSIGNED", "reopen_count": 1,
                  "reopened_at": _utcnow()}})

    _sweep()
    refreshed = grievances_collection.find_one({"grievance_id": case["grievance_id"]})
    assert refreshed["sla_cycle"] == 1
    assert refreshed["sla_status"] == "ON_TRACK"
    assert "CYCLE_RESTART" in _levels_for(case["grievance_id"], cycle=1)
    # Old-cycle events exist but the new cycle starts clean of new breaches.
    assert "BREACH" not in _levels_for(case["grievance_id"], cycle=1)


def test_reopen_remaining_policy_grants_only_leftover_time():
    config = sla_service.get_config()
    config["reopen_policy"] = "REMAINING"
    sla_service.save_config(config, {"_id": None, "role": "admin", "name": "T"})

    started = _utcnow() - timedelta(hours=70)  # 72h window, 2h left
    case = _make_case(priority="MEDIUM", started_at=started)
    grievances_collection.update_one(
        {"grievance_id": case["grievance_id"]},
        {"$set": {"status": "REOPENED", "reopen_count": 1,
                  "reopened_at": _utcnow(),
                  "resolved_at": None}})

    _sweep()
    refreshed = grievances_collection.find_one({"grievance_id": case["grievance_id"]})
    assert refreshed["sla_cycle"] == 1
    assert refreshed["sla_hours"] <= 3  # ~2h remaining, never a fresh 72h


# ---------------------------------------------------------------------------
# Working-hours policy
# ---------------------------------------------------------------------------

def test_working_hours_deadline_skips_non_working_days():
    config = sla_service.get_config()
    config["working_hours"] = {"enabled": True, "start_hour": 9, "end_hour": 17,
                               "work_days": [0, 1, 2, 3, 4]}  # Mon-Fri, 8h days
    sla_service.save_config(config, {"_id": None, "role": "admin", "name": "T"})

    monday_6am = datetime(2026, 11, 16, 6, 0, 0)  # weekday()==0
    case = _make_case(priority="MEDIUM", started_at=monday_6am)  # 72 working hours
    assert case["sla_hours"] == 72
    # 72 working-hour units = 9 full working days; clock starts 9am (before
    # window), day 1 contributes 8h... deadline must land on weekday hours.
    due = case["sla_due_at"]
    assert due.weekday() in range(5)
    assert due.hour == 17 or (due - monday_6am).days >= 9
    # The window is strictly longer than the calendar-hour equivalent.
    assert due > monday_6am + timedelta(hours=72)


# ---------------------------------------------------------------------------
# 11: Configuration authorization
# ---------------------------------------------------------------------------

def test_only_super_admin_can_change_sla_config(actors):
    body = {"priority_hours": {"LOW": 200}}
    _user("sla_citizen_cfg@test.com", "citizen")
    _user("sla_officer_cfg@test.com", "officer", department=DEPT, district="Chennai")
    _user("sla_district_cfg@test.com", "admin", district="Chennai")

    assert client.put("/api/sla/config", json=body).status_code == 401
    assert client.put("/api/sla/config", json=body,
                      headers=_login("sla_citizen_cfg@test.com")).status_code == 403
    assert client.put("/api/sla/config", json=body,
                      headers=_login("sla_officer_cfg@test.com")).status_code == 403
    assert client.put("/api/sla/config", json=body,
                      headers=_login("sla_district_cfg@test.com")).status_code == 403

    # A citizen cannot even read staff config.
    assert client.get("/api/sla/config",
                      headers=_login("sla_citizen_cfg@test.com")).status_code == 403

    r = client.put("/api/sla/config", json=body,
                   headers=_login("sla_super@test.com"))
    assert r.status_code == 200, r.text
    assert r.json()["data"]["priority_hours"]["LOW"] == 200


def test_config_validation_rejects_nonsense(actors):
    headers = _login("sla_super@test.com")
    r = client.put("/api/sla/config", json={"priority_hours": {"LOW": -5}}, headers=headers)
    assert r.status_code == 422
    r = client.put("/api/sla/config",
                   json={"thresholds": {"warning": 0.95, "urgent": 0.5}}, headers=headers)
    assert r.status_code == 422
    r = client.put("/api/sla/config",
                   json={"priority_hours": {"NONSENSE": 5}}, headers=headers)
    assert r.status_code == 422


# ---------------------------------------------------------------------------
# 12: Reporting endpoints from real data
# ---------------------------------------------------------------------------

def _seed_report_population():
    now = _utcnow()
    # On-time resolved (MEDIUM, resolved at 50%).
    a = _case_at_elapsed("MEDIUM", 0.5)
    grievances_collection.update_one({"grievance_id": a["grievance_id"]},
                                     {"$set": {"status": "CLOSED",
                                               "resolved_at": a["sla_start_at"] + timedelta(hours=36)}})
    # Late resolved (MEDIUM resolved at 150%).
    b = _case_at_elapsed("MEDIUM", 1.5)
    grievances_collection.update_one({"grievance_id": b["grievance_id"]},
                                     {"$set": {"status": "CLOSED",
                                               "resolved_at": b["sla_start_at"] + timedelta(hours=108)}})
    # Active breach.
    c = _case_at_elapsed("HIGH", 1.2)
    return a, b, c


def test_dashboard_reflects_seeded_database_state(actors):
    a, b, c = _seed_report_population()
    headers = _login("sla_super@test.com")

    # Sweep so sla_status mirrors the ratios.
    _sweep()

    r = client.get("/api/sla/dashboard", headers=headers)
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    overview = data["overview"]

    # Our three cases: 2 resolved (1 on time), >=1 active breached (case c).
    assert overview["resolved_total"] >= 2
    assert overview["on_time_resolutions"] >= 1
    assert overview["breached"] >= 1
    assert overview["total_active"] >= 1
    # Compliance = on-time / eligible-resolved, computed not hardcoded.
    assert 0 < overview["compliance_pct"] <= 100
    # An active case past deadline counts in the overdue rate, never in
    # compliance (unresolved cases don't penalize the denominator).
    assert overview["overdue_active"] >= 1

    # The breached case shows in the critical/high table.
    ids = [row["grievance_id"] for row in data["critical_unresolved"]]
    assert c["grievance_id"] in ids


def test_overdue_and_warning_lists(actors):
    a, b, c = _seed_report_population()
    w = _case_at_elapsed("LOW", 0.85)
    headers = _login("sla_super@test.com")
    _sweep()

    r = client.get("/api/sla/overdue", headers=headers)
    assert r.status_code == 200
    ids = [row["grievance_id"] for row in r.json()["data"]["items"]]
    assert c["grievance_id"] in ids
    assert w["grievance_id"] not in ids

    r = client.get("/api/sla/warnings", headers=headers)
    ids = [row["grievance_id"] for row in r.json()["data"]["items"]]
    assert w["grievance_id"] in ids
    assert c["grievance_id"] not in ids


def test_department_performance_and_csv_export(actors):
    _seed_report_population()
    headers = _login("sla_super@test.com")

    r = client.get("/api/sla/department-performance", headers=headers)
    assert r.status_code == 200, r.text
    rows = r.json()["data"]["departments"]
    row = next(d for d in rows if d["department"] == DEPT)
    assert row["total"] >= 3
    assert row["resolved"] >= 2
    assert row["overdue"] >= 1
    assert row["rank"] >= 1

    r = client.get("/api/sla/reports?format=csv", headers=headers)
    assert r.status_code == 200
    assert "text/csv" in r.headers["content-type"]
    assert "Department" in r.text and DEPT in r.text


def test_district_admin_only_sees_own_district(actors):
    _case_at_elapsed("MEDIUM", 0.5)  # Chennai (default in helper)
    other = _case_at_elapsed("MEDIUM", 1.5)
    grievances_collection.update_one({"grievance_id": other["grievance_id"]},
                                     {"$set": {"district": "Mumbai"}})

    r = client.get("/api/sla/overdue", headers=_login("sla_district_admin@test.com"))
    assert r.status_code == 200
    for row in r.json()["data"]["items"]:
        assert row["district"] == "Chennai"

    r = client.get("/api/sla/dashboard", headers=_login("sla_other_admin@test.com"))
    assert r.json()["data"]["overview"]["total_active"] == 1


# ---------------------------------------------------------------------------
# Per-case tracking endpoint + manual escalation
# ---------------------------------------------------------------------------

def test_case_sla_endpoint_and_manual_escalation(actors):
    _user("sla_citizen_other@test.com", "citizen")
    case = _case_at_elapsed("HIGH", 1.30)
    grievances_collection.update_one(
        {"grievance_id": case["grievance_id"]},
        {"$set": {"assigned_officer": actors["officer"]["_id"]}})
    _sweep()

    officer_headers = _login("sla_officer@test.com")
    r = client.get(f"/api/sla/{case['grievance_id']}", headers=officer_headers)
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data["sla_due_at"] is not None
    assert data["seconds_remaining"] < 0
    levels = {h["level"] for h in data["escalation_history"]}
    assert {"WARNING", "URGENT", "BREACH", "SENIOR_ESCALATION"} <= levels

    r = client.post(f"/api/sla/{case['grievance_id']}/escalate",
                    json={"reason": "Press attention"}, headers=officer_headers)
    assert r.status_code == 200, r.text
    assert "MANUAL_ESCALATION" in _levels_for(case["grievance_id"])

    # Citizens who don't own the case can't read or trigger it.
    r = client.get(f"/api/sla/{case['grievance_id']}",
                   headers=_login("sla_citizen_other@test.com"))
    assert r.status_code == 403
    r = client.post(f"/api/sla/{case['grievance_id']}/escalate",
                    json={"reason": "x"}, headers=_login("sla_citizen_other@test.com"))
    assert r.status_code == 403


def test_escalation_log_shape_is_complete(actors):
    case = _case_at_elapsed("MEDIUM", 1.10)
    grievances_collection.update_one(
        {"grievance_id": case["grievance_id"]},
        {"$set": {"assigned_officer": actors["officer"]["_id"]}})
    _sweep()

    row = sla_logs_collection.find_one(
        {"grievance_id": case["grievance_id"], "level": "BREACH"})
    for field in ("grievance_id", "department", "priority", "created_at", "level",
                  "cycle", "sla_due_at", "recipient_ids", "threshold", "assigned_officer"):
        assert field in row, field
    assert row["department"] == DEPT
    assert row["assigned_officer"] == str(actors["officer"]["_id"])
    assert str(actors["officer"]["_id"]) in row["recipient_ids"]
