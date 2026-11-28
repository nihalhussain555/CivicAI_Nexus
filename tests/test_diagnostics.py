"""Error diagnosis and recovery: classification, redaction, capture, reporting.

The two properties that make this system safe to ship are tested hardest:

* a diagnosis never carries a credential, because technical details are shown to
  whoever sees the error and stored in a collection admins read;
* capture never *causes* a failure — an error tracker that 500s, or that loses
  events silently, is worse than no tracker.
"""

from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.config.database import error_events_collection, users_collection
from app.main import app
from app.models.user import user_document
from app.utils.error_catalog import build_diagnosis, redact
from app.utils.security import hash_password

client = TestClient(app)


# --- fixtures / helpers -----------------------------------------------------

ADMIN_EMAIL = "errdiag-admin@demo.com"
ADMIN_PASSWORD = "Demo@123"


def _admin_token():
    if users_collection.count_documents({"email": ADMIN_EMAIL}) == 0:
        users_collection.insert_one(user_document(
            "Error Admin", ADMIN_EMAIL, hash_password(ADMIN_PASSWORD), role="admin"
        ))
    r = client.post("/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    return {"Authorization": f"Bearer {r.json()["data"]["access_token"]}"}


CITIZEN_EMAIL = "diagcitizen@demo.com"


def _citizen_token():
    # Idempotent: several tests need a citizen, and re-registering the same
    # email returns a 400 rather than a fresh OTP.
    if users_collection.count_documents({"email": CITIZEN_EMAIL}) == 0:
        r = client.post("/api/auth/register", json={
            "name": "Diag Citizen", "email": CITIZEN_EMAIL, "password": ADMIN_PASSWORD,
        })
        dev_otp = r.json()["data"]["dev_otp"]
        client.post("/api/auth/verify-otp", json={"email": CITIZEN_EMAIL, "otp_code": dev_otp})
    r = client.post("/api/auth/login", json={"email": CITIZEN_EMAIL, "password": ADMIN_PASSWORD})
    return {"Authorization": f"Bearer {r.json()["data"]["access_token"]}"}


def _clear_events():
    error_events_collection.delete_many({})


def _all_text(payload):
    return repr(payload)


# --- classification ---------------------------------------------------------

def test_database_outage_classifies_as_blocking_database():
    d = build_diagnosis(
        status_code=500,
        message="ServerSelectionTimeoutError: No servers found yet, Timeout: 5.0s",
        path="/api/grievances",
        method="POST",
    )
    assert d["category"] == "database"
    assert d["severity"] == "blocking"
    assert d["feature_label"] == "Filing a grievance"
    assert d["retryable"] is True
    # Every diagnosis carries all four things a user needs to see.
    assert d["what"] and d["reason"] and d["solution"]


def test_quota_inside_a_500_is_an_ai_outage_not_a_platform_bug():
    d = build_diagnosis(status_code=500, message="Error code: 429 insufficient_quota",
                        path="/api/ai/chat", method="POST")
    assert d["category"] == "ai_provider"
    assert "credit" in d["what"]
    assert d["feature_label"] == "AI assistant"


def test_voice_and_upload_failures_keep_their_own_category():
    voice = build_diagnosis(message="no speech detected in audio", category="voice")
    assert voice["category"] == "voice"
    assert "type your message" in voice["solution"].lower()

    upload = build_diagnosis(status_code=413, message="File too large", path="/api/uploads/image")
    assert upload["category"] == "upload"


def test_unknown_failures_still_produce_a_full_diagnosis():
    d = build_diagnosis(message="completely unrecognised")
    assert d["category"] in ("unknown", "client")
    assert d["what"] and d["reason"] and d["solution"]
    assert d["severity"] in ("blocking", "degraded", "minor")


# --- redaction --------------------------------------------------------------

@pytest.mark.parametrize("raw, forbidden", [
    ("openai.AuthenticationError: Incorrect API key provided: sk-proj-1234567890abcdef", "sk-proj-1234567890abcdef"),
    ('401 {"error":{"api_key":"gsk_abcdef1234567890ABCD"}}', "gsk_abcdef1234567890ABCD"),
    ("invalid key AIzaSyD-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "AIzaSyD-aaaaaaaaaaaaaaaa"),
    ("Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
     "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"),
    ("login failed password=CorrectHorse123", "CorrectHorse123"),
    ("could not read /home/nihal hussain/app/.env", "nihal hussain/app"),
])
def test_secrets_never_survive_redaction(raw, forbidden):
    assert forbidden not in redact(raw)


def test_diagnosis_technical_block_is_redacted_too():
    d = build_diagnosis(status_code=500,
                        message="pymongo error: cannot connect mongodb://u:Sup3rS3cret@host:27017")
    assert "Sup3rS3cret" not in _all_text(d)


# --- capture through the real handlers --------------------------------------

def test_unhandled_exception_is_diagnosed_captured_and_safe():
    from pymongo.errors import ServerSelectionTimeoutError

    @app.get("/_diagtest/boom")
    def _boom():
        raise ServerSelectionTimeoutError(
            "ServerSelectionTimeoutError: No servers found, "
            "uri mongodb://diagtest:DiagS3cret@cluster0.abc.mongodb.net/test"
        )

    strict = TestClient(app, raise_server_exceptions=False)
    response = strict.get("/_diagtest/boom")

    assert response.status_code == 500
    body = response.json()
    # The envelope the frontend already understands is preserved.
    assert body["success"] is False
    assert body["error"]["code"] == 500
    diagnosis = body["error"]["diagnosis"]
    assert diagnosis["category"] == "database"
    assert diagnosis["retryable"] is True
    assert "DiagS3cret" not in _all_text(body)
    assert diagnosis.get("error_ref")

    # Scoped to this route: other suites deliberately provoke 500s too, and a
    # bare find_one({"source": "backend"}) would match whichever came first.
    stored = error_events_collection.find_one(
        {"source": "backend", "technical.path": "/_diagtest/boom"}
    )
    assert stored is not None, "500 was not recorded"
    assert stored["category"] == "database"
    assert stored["fingerprint"]
    assert "DiagS3cret" not in _all_text(stored)


def test_known_http_error_gets_a_diagnosis_without_storing_noise():
    response = client.post("/api/auth/login", json={"email": "nobody@demo.com", "password": "wrong"})
    assert response.status_code in (401, 400, 403)
    body = response.json()
    assert body["success"] is False
    diagnosis = body["error"]["diagnosis"]
    assert diagnosis["category"] == "auth"
    # The login route gets the tighter label than the auth area as a whole.
    assert diagnosis["feature_label"] == "Signing in"


def test_bad_password_is_not_recorded_as_a_platform_error():
    _clear_events()
    client.post("/api/auth/register", json={
        "name": "Noisy", "email": "noisy@demo.com", "password": "Demo@123",
    })
    client.post("/api/auth/login", json={"email": "noisy@demo.com", "password": "totally-wrong"})
    assert error_events_collection.count_documents({}) == 0


def test_validation_failure_is_explained_but_not_stored():
    _clear_events()
    headers = _citizen_token()
    response = client.post("/api/grievances", json={"title": "x"}, headers=headers)
    assert response.status_code == 422
    body = response.json()
    assert body["error"]["diagnosis"]["category"] == "validation"
    assert error_events_collection.count_documents({}) == 0


# --- client ingest ----------------------------------------------------------

def test_client_error_is_recorded_and_classified():
    _clear_events()
    response = client.post("/api/diagnostics/client-error", json={
        "feature": "voice_capture",
        "message": "NotAllowedError: Permission denied to access microphone",
        "path": "/citizen/report",
    })
    assert response.status_code == 202
    assert response.json()["data"]["recorded"] is True

    event = error_events_collection.find_one({"feature": "voice_capture"})
    assert event["source"] == "frontend"
    assert event["category"] == "client"


def test_client_error_context_is_trimmed_to_scalars():
    _clear_events()
    client.post("/api/diagnostics/client-error", json={
        "feature": "file_upload",
        "message": "upload failed",
        "context": {"size": 123, "blob": "x" * 5000, "nested": {"a": 1}},
    })
    event = error_events_collection.find_one({"feature": "file_upload"})
    stored = event["context"]["client"]
    assert all(len(str(v)) <= 200 for v in stored.values())


def test_client_error_without_a_token_still_works():
    # A failed login has no bearer token to send; reporting must still land.
    _clear_events()
    response = client.post("/api/diagnostics/client-error", json={
        "feature": "auth", "message": "Network Error",
    })
    assert response.status_code == 202


def test_forged_client_timestamp_is_ignored():
    _clear_events()
    # A browser clock years off must not be allowed to reorder the dashboard.
    client.post("/api/diagnostics/client-error", json={
        "feature": "map", "message": "tile failed", "occurred_at": "2001-01-01T00:00:00Z",
    })
    event = error_events_collection.find_one({"feature": "map"})
    assert event["occurred_at"] >= datetime.now(timezone.utc).replace(tzinfo=None).replace(hour=0)


# --- user reports -----------------------------------------------------------

def test_report_issue_stores_the_note_and_links_the_event():
    _clear_events()
    first = client.post("/api/diagnostics/client-error", json={
        "feature": "location", "message": "User denied Geolocation",
    }).json()["data"]["error_ref"]

    response = client.post("/api/diagnostics/report", json={
        "note": "The map never found my area and I could not submit.",
        "feature": "location",
        "error_ref": first,
        "steps": ["Open report form", "Tap use my location"],
    })
    assert response.status_code == 201
    data = response.json()["data"]
    assert data["recorded"] is True

    report = error_events_collection.find_one({"source": "user_report"})
    assert report["reported_by_user"] is True
    assert report["context"]["linked_error_ref"] == first
    assert report["context"]["steps"] == ["Open report form", "Tap use my location"]


def test_report_issue_requires_a_note():
    response = client.post("/api/diagnostics/report", json={"note": "ab"})
    assert response.status_code == 422


def test_report_redacts_credentials_from_a_pasted_note():
    _clear_events()
    client.post("/api/diagnostics/report", json={
        "note": "It failed and my api key is sk-proj-SUPERSECRETKEY123 in the console",
    })
    report = error_events_collection.find_one({"source": "user_report"})
    assert "SUPERSECRETKEY123" not in _all_text(report)


# --- admin surface ----------------------------------------------------------

def test_diagnostics_endpoints_are_admin_only():
    assert client.get("/api/diagnostics/summary").status_code == 401
    headers = _citizen_token()
    assert client.get("/api/diagnostics/summary", headers=headers).status_code == 403


def test_groups_report_occurrence_counts_and_status():
    _clear_events()
    headers = _admin_token()

    for _ in range(3):
        client.post("/api/diagnostics/client-error", json={
            "feature": "network", "message": "Network Error: backend unreachable",
        })
    client.post("/api/diagnostics/client-error", json={
        "feature": "voice_capture", "message": "NotAllowedError: permission denied",
    })

    groups = client.get("/api/diagnostics/groups?days=7", headers=headers).json()["data"]["items"]
    assert max(g["count"] for g in groups) == 3
    assert any(g["feature"] == "voice_capture" for g in groups)

    network_group = next(g for g in groups if g["feature"] == "network")
    updated = client.patch("/api/diagnostics/events/status", headers=headers, json={
        "fingerprint": network_group["fingerprint"], "status": "triaged",
    })
    assert updated.json()["data"]["updated"] == 3

    filtered = client.get("/api/diagnostics/groups?status=triaged&days=7", headers=headers)
    assert [g["fingerprint"] for g in filtered.json()["data"]["items"]] == [network_group["fingerprint"]]


def test_summary_counts_categories_and_user_reports():
    _clear_events()
    headers = _admin_token()
    client.post("/api/diagnostics/client-error", json={
        "feature": "upload", "message": "file too large"})
    client.post("/api/diagnostics/report", json={"note": "uploads keep failing for me"})

    data = client.get("/api/diagnostics/summary?days=7", headers=headers).json()["data"]
    assert data["total"] == 2
    assert data["user_reports"] == 1
    assert data["new_last_24h"] == 2
    assert data["by_category"]


def test_events_listing_and_detail():
    _clear_events()
    headers = _admin_token()
    # The frontend pins the subsystem it was talking to, rather than leaving a
    # bare "timed out" to be guessed at.
    ref = client.post("/api/diagnostics/client-error", json={
        "feature": "ai_chat", "category": "ai_provider",
        "message": "AI request timed out"}).json()["data"]["error_ref"]

    listed = client.get("/api/diagnostics/events?days=7", headers=headers).json()["data"]["items"]
    assert len(listed) == 1
    assert listed[0]["source"] == "frontend"

    detail = client.get(f"/api/diagnostics/events/{ref}", headers=headers)
    assert detail.status_code == 200
    assert detail.json()["data"]["category"] == "ai_provider"


def test_unknown_event_id_is_a_clean_404():
    headers = _admin_token()
    response = client.get("/api/diagnostics/events/not-an-object-id", headers=headers)
    assert response.status_code == 404
    assert response.json()["success"] is False


def test_invalid_status_value_is_rejected():
    headers = _admin_token()
    response = client.patch("/api/diagnostics/events/status", headers=headers,
                            json={"fingerprint": "abc", "status": "wontfix"})
    assert response.status_code == 422


# --- demo mode must not swallow the reports ------------------------------
#
# Found by running the app: the site blocks every mutating request from a demo
# account, and diagnostics ingest is a POST. Left alone, the demo deployment
# this project ships as accepted 403 for every error report, so the dashboard
# was permanently empty and no test below caught it — they all post unauthed.

DEMO_EMAIL = "diagsdemo@demo.com"


def _demo_token(monkeypatch):
    from app.config.settings import settings
    from app.utils.security import create_access_token, hash_password as _hp  # noqa: F401
    from app.models.user import user_document as _ud

    monkeypatch.setattr(settings, "DEMO_MODE", False, raising=False)
    if users_collection.count_documents({"email": DEMO_EMAIL}) == 0:
        users_collection.insert_one(
            user_document("Demo Diag", DEMO_EMAIL, hash_password(ADMIN_PASSWORD),
                          role="citizen")
        )
    # The demo flag is a token claim, not a column — that is what the guard reads.
    user = users_collection.find_one({"email": DEMO_EMAIL})
    return {"Authorization": f"Bearer {create_access_token(str(user['_id']), 'citizen', True)}"}


def test_demo_account_can_report_an_error(monkeypatch):
    _clear_events()
    headers = _demo_token(monkeypatch)

    r1 = client.post("/api/diagnostics/client-error", headers=headers, json={
        "category": "network", "feature": "grievance_list",
        "message": "Network Error", "path": "/citizen/dashboard",
    })
    r2 = client.post("/api/diagnostics/report", headers=headers, json={
        "note": "Demo account report", "feature": "report_issue",
        "category": "client", "path": "/citizen/report",
    })

    assert r1.status_code == 202, r1.text
    assert r2.status_code == 201, r2.text
    assert error_events_collection.count_documents({}) == 2
    # Requirement 5 wording, returned to the citizen.
    assert r2.json()["data"]["recorded"] is True


def test_demo_block_still_applies_to_real_writes(monkeypatch):
    # The whitelist above has to stay narrow: being able to file telemetry must
    # not quietly grant a demo account the right to create grievances.
    headers = _demo_token(monkeypatch)
    response = client.post("/api/grievances", headers=headers, json={
        "description": "should be blocked", "category": "garbage",
        "district": "Chennai",
    })
    assert response.status_code == 403
    assert response.json().get("demo_mode") is True


# --- one failure, one row ---------------------------------------------------

def test_feature_keys_match_the_browser_vocabulary():
    """The server must name features with the same keys the client sends.

    Groups are fingerprinted on the feature field, so '/api/auth' from the
    server beside 'auth' from the browser shows one outage as two rows and
    halves every occurrence count.
    """
    from app.utils.error_catalog import CLIENT_FEATURE_LABELS, feature_for_path

    cases = {
        ("/api/auth/login", "POST"): "auth",
        ("/api/auth/me", "GET"): "auth",
        ("/api/grievances", "GET"): "grievance_list",
        ("/api/grievances", "POST"): "grievance_submit",
        ("/api/grievances/abc123", "GET"): "grievance_detail",
        ("/api/grievances/integrity", "GET"): "grievance_list",
        ("/api/ai/voice/transcribe", "POST"): "voice_capture",
        ("/api/uploads", "POST"): "file_upload",
        ("/api/users/me", "GET"): "profile",
        ("/api/some/unknown/route", "GET"): "unknown",
    }
    for (path, method), expected in cases.items():
        got = feature_for_path(path, method)
        assert got == expected, f"{method} {path}: got {got}, want {expected}"
        assert got in CLIENT_FEATURE_LABELS, f"{got} has no label"
