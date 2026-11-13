"""The community-incident list, filtered the way the incident page filters it.

Nothing exercised this endpoint before: the UI only ever sent risk_level, and
even that came back without a page count, so the pager never appeared.
"""

import math

from fastapi.testclient import TestClient

from app.main import app
from app.config.database import incidents_collection
from app.models.incident import incident_document

client = TestClient(app)

CENTER = {"type": "Point", "coordinates": [80.27, 13.08]}


def _auth(email):
    r = client.post("/api/auth/register", json={"name": "Incident Citizen", "email": email, "password": "Demo@123"})
    client.post("/api/auth/verify-otp", json={"email": email, "otp_code": r.json()["data"]["dev_otp"]})
    token = client.post("/api/auth/login", json={"email": email, "password": "Demo@123"}).json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _cluster(code, **fields):
    incidents_collection.insert_one({
        **incident_document(f"INC-{code}", f"Cluster {code}", "WATER", CENTER),
        **fields,
    })


def _ids(headers, **params):
    r = client.get("/api/incidents/", params=params, headers=headers)
    assert r.status_code == 200
    return {i["incident_id"] for i in r.json()["data"]["items"]}


def test_the_incident_list_answers_every_filter_the_page_sends():
    headers = _auth("incident_filters@test.com")
    for code, fields in [
        ("A1", {"status": "ACTIVE", "risk_level": "HIGH"}),
        ("A2", {"status": "ACTIVE", "risk_level": "LOW"}),
        ("A3", {"status": "RESOLVED", "risk_level": "HIGH"}),
        ("A4", {"status": "ACTIVE", "risk_level": "HIGH", "category": "WASTE"}),
    ]:
        _cluster(code, **fields)

    # Subset checks, not equality: clustering other tests file can add its own
    # ACTIVE/HIGH/WATER rows, and this has to say what the filters guarantee,
    # not what happened to be in the database that run.
    assert {"INC-A1", "INC-A3"} <= _ids(headers, risk_level="HIGH", category="WATER")
    assert {"INC-A3"} <= _ids(headers, status="RESOLVED")
    assert "INC-A2" not in _ids(headers, risk_level="HIGH")
    assert "INC-A4" not in _ids(headers, category="WATER")
    assert {"INC-A1"} <= _ids(headers, status="ACTIVE", risk_level="HIGH", category="WATER")
    assert _ids(headers, status="NOT_A_STATUS") == set()


def test_the_incident_list_reports_how_many_pages_there_are():
    headers = _auth("incident_pages@test.com")
    _cluster("P1", status="ACTIVE")

    r = client.get("/api/incidents/", params={"limit": 1}, headers=headers)
    payload = r.json()["data"]

    # Without total_pages the pager renders nothing at all, however many
    # clusters matched — the list just looks like it stopped.
    assert payload["total_pages"] == math.ceil(payload["total"] / payload["limit"])
    assert len(payload["items"]) <= 1
