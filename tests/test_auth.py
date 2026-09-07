from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def register_and_login(email, name="Test User", password="Demo@123"):
    r = client.post("/api/auth/register", json={"name": name, "email": email, "password": password})
    # Mock EMAIL_PROVIDER (the test default) returns the OTP directly so
    # signup can be tested end-to-end without a real email account.
    dev_otp = r.json()["data"]["dev_otp"]
    client.post("/api/auth/verify-otp", json={"email": email, "otp_code": dev_otp})
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    return r.json()["data"]["access_token"]


def test_register_creates_citizen():
    r = client.post("/api/auth/register", json={
        "name": "Alice Citizen", "email": "alice@test.com", "password": "Demo@123",
    })
    assert r.status_code == 200
    assert r.json()["success"] is True


def test_register_duplicate_email_rejected():
    client.post("/api/auth/register", json={
        "name": "Bob One", "email": "bob@test.com", "password": "Demo@123",
    })
    r = client.post("/api/auth/register", json={
        "name": "Bob Two", "email": "bob@test.com", "password": "Demo@123",
    })
    assert r.status_code == 400


def test_login_wrong_password_rejected():
    client.post("/api/auth/register", json={
        "name": "Carol X", "email": "carol@test.com", "password": "Demo@123",
    })
    r = client.post("/api/auth/login", json={"email": "carol@test.com", "password": "WrongPass1"})
    assert r.status_code == 401


def test_login_returns_valid_token_usable_for_me():
    token = register_and_login("dave@test.com", "Dave User")
    r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["data"]["email"] == "dave@test.com"
    assert r.json()["data"]["role"] == "citizen"


def test_protected_endpoint_requires_token():
    r = client.get("/api/auth/me")
    assert r.status_code == 401


def test_invalid_token_rejected():
    r = client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-real-token"})
    assert r.status_code == 401


def test_citizen_cannot_access_admin_routes():
    token = register_and_login("erin@test.com", "Erin User")
    r = client.get("/api/admin/users", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 403


def test_citizen_cannot_access_officer_queue():
    token = register_and_login("frank@test.com", "Frank User")
    r = client.get("/api/grievances/queue", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 403


def test_register_returns_dev_otp_in_mock_mode():
    r = client.post("/api/auth/register", json={
        "name": "OTP Flow Tester", "email": "otpflow1@test.com", "password": "Demo@123",
    })
    assert r.status_code == 200
    assert "dev_otp" in r.json()["data"]
    assert len(r.json()["data"]["dev_otp"]) == 6


def test_login_blocked_before_otp_verification():
    client.post("/api/auth/register", json={
        "name": "Unverified User", "email": "unverified1@test.com", "password": "Demo@123",
    })
    r = client.post("/api/auth/login", json={"email": "unverified1@test.com", "password": "Demo@123"})
    assert r.status_code == 403
    assert "verify" in r.json()["error"]["message"].lower()


def test_wrong_otp_rejected():
    client.post("/api/auth/register", json={
        "name": "Wrong OTP User", "email": "wrongotp1@test.com", "password": "Demo@123",
    })
    r = client.post("/api/auth/verify-otp", json={"email": "wrongotp1@test.com", "otp_code": "000000"})
    assert r.status_code == 400


def test_correct_otp_unlocks_login():
    r = client.post("/api/auth/register", json={
        "name": "Correct OTP User", "email": "correctotp1@test.com", "password": "Demo@123",
    })
    dev_otp = r.json()["data"]["dev_otp"]

    r = client.post("/api/auth/verify-otp", json={"email": "correctotp1@test.com", "otp_code": dev_otp})
    assert r.status_code == 200

    r = client.post("/api/auth/login", json={"email": "correctotp1@test.com", "password": "Demo@123"})
    assert r.status_code == 200


def test_resend_otp_issues_new_code():
    client.post("/api/auth/register", json={
        "name": "Resend Flow User", "email": "resendflow1@test.com", "password": "Demo@123",
    })
    r = client.post("/api/auth/resend-otp", json={"email": "resendflow1@test.com"})
    assert r.status_code == 200
    new_otp = r.json()["data"]["dev_otp"]

    r = client.post("/api/auth/verify-otp", json={"email": "resendflow1@test.com", "otp_code": new_otp})
    assert r.status_code == 200


def test_pre_verified_account_skips_otp():
    # Mirrors how seeded/demo accounts are created (email_verified=True
    # set directly, bypassing the OTP flow) — this file's TestClient isn't
    # opened as a context manager, so the app's startup/auto-seed lifespan
    # never actually runs here, hence creating the account directly rather
    # than relying on the seeded citizen@demo.com existing.
    from app.config.database import users_collection
    from app.models.user import user_document
    from app.utils.security import hash_password

    email = "preverified1@test.com"
    user = user_document("Pre Verified", email, hash_password("Demo@123"), role="citizen")
    user["email_verified"] = True
    users_collection.insert_one(user)

    r = client.post("/api/auth/login", json={"email": email, "password": "Demo@123"})
    assert r.status_code == 200