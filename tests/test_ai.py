from app.ai.provider import MockAIProvider
from app.services.ai_pipeline_service import run_pipeline
from app.services.duplicate_service import similarity, find_duplicate
from app.services.prediction_service import predict_resolution_hours, assess_escalation_risk


def test_mock_provider_returns_required_fields():
    provider = MockAIProvider()
    result = provider.analyze_grievance("There is no water supply in our street for two days.")

    required_keys = {
        "category", "severity", "urgency_score", "priority", "priority_score",
        "confidence", "sentiment", "recommended_department", "summary", "recommended_action",
    }
    assert required_keys.issubset(result.keys())
    assert result["category"] == "WATER"
    assert result["priority"] in ("LOW", "MEDIUM", "HIGH", "CRITICAL")
    assert 0 <= result["confidence"] <= 1


def test_mock_provider_is_deterministic_for_same_input():
    provider = MockAIProvider()
    text = "Garbage overflow near the market causing bad smell."
    r1 = provider.analyze_grievance(text)
    r2 = provider.analyze_grievance(text)
    assert r1["category"] == r2["category"]
    assert r1["priority"] == r2["priority"]


def test_pipeline_produces_full_structured_output():
    result = run_pipeline("Streetlight not working on Anna Nagar 4th Avenue for a week.")
    for key in (
        "category", "severity", "urgency_score", "priority", "priority_score",
        "confidence", "department", "predicted_resolution_hours", "escalation_risk",
        "ai_summary", "recommended_action", "sla_due_at",
    ):
        assert key in result
    assert result["category"] == "STREET_LIGHT"


def test_similarity_identical_text_is_one():
    text = "Overflowing garbage bin near the market street"
    assert similarity(text, text) == 1.0


def test_similarity_unrelated_text_is_low():
    score = similarity("Overflowing garbage bin", "Traffic signal broken at junction")
    assert score < 0.3


def test_predict_resolution_hours_scales_with_severity():
    low = predict_resolution_hours("ROAD", "LOW")
    critical = predict_resolution_hours("ROAD", "CRITICAL")
    assert critical < low


def test_escalation_risk_increases_with_overdue_sla():
    low_risk = assess_escalation_risk("LOW", 0, 0, hours_since_created=1, sla_hours=168)
    high_risk = assess_escalation_risk("HIGH", 80, 6, hours_since_created=200, sla_hours=24)
    assert low_risk == "LOW"
    assert high_risk == "HIGH"


def test_image_analysis_falls_back_to_mock_without_bytes():
    from app.services.image_service import analyze_image
    result = analyze_image("photo.jpg", "image/jpeg")
    assert result["provider"] == "mock"
    assert "description" in result


def test_speech_transcription_falls_back_to_mock_without_bytes():
    from app.services.speech_service import transcribe_audio
    result = transcribe_audio("note.webm", "audio/webm", language="English")
    assert result["provider"] == "mock"
    assert "transcript" in result


def test_upload_image_endpoint_returns_ai_caption(tmp_path, monkeypatch):
    from fastapi.testclient import TestClient
    from app.main import app
    from app.config.settings import settings

    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    client = TestClient(app)

    client.post("/api/auth/register", json={"name": "Upload Tester", "email": "uploader@test.com", "password": "Demo@123"})
    r = client.post("/api/auth/login", json={"email": "uploader@test.com", "password": "Demo@123"})
    token = r.json()["data"]["access_token"]

    files = {"file": ("test.jpg", b"\xff\xd8\xff\xe0fakejpegbytes", "image/jpeg")}
    r = client.post("/api/uploads/image", files=files, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["url"].startswith("/uploads/")
    assert "ai_description" in data
    assert data["ai_provider"] == "mock"
