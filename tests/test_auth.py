from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def register_and_login(email, name="Test User", password="Demo@123"):
    client.post("/api/auth/register", json={"name": name, "email": email, "password": password})
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
