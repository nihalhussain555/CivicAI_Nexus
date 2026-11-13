"""The multilingual voice assistant: hearing a recording, working out what
language it was in, and keeping only what the citizen's privacy settings
allow.

Three things get tested hard, because they are the three the design keeps
depending on:

* the deterministic language read — it runs on every complaint, offline, and
  decides which department sees a report filed by someone who never typed
  English;
* that a provider we cannot reach degrades into an honest "type it instead"
  rather than a confident invention;
* that `keep_audio` / `keep_transcript` are applied *before* anything is
  written, so a citizen who said no never has a recording on the server for
  it to be deleted later.
"""

import math
import os
from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.config.database import grievances_collection
from app.config.settings import settings
from app.main import app
from app.services import speech_service, voice_service
from app.services.translation_service import (
    SUPPORTED_LANGUAGES,
    analyze_language,
    language_name,
    understand_text,
)

client = TestClient(app)


# A minimal EBML/matroska header: enough for the container sniffer to call
# this a webm without carrying a real recording around in the test file.
WEBM_BYTES = b"\x1a\x45\xdf\xa3\x01\x00\x00\x00\x00\x00\x00\x1f" + b"\x00" * 64

WATER_COMPLAINTS = {
    "Tamil": "எங்கள் பகுதியில் குடிநீர் வரவில்லை",
    "Hindi": "हमारे इलाके में दो दिन से पानी नहीं आ रहा है",
    "Telugu": "మా ప్రాంతంలో రెండు రోజులుగా నీరు రావడం లేదు",
    "Kannada": "ನಮ್ಮ ಊರಿನಲ್ಲಿ ಎರಡು ದಿನಗಳಿಂದ ನೀರು ಇಲ್ಲ",
    "Malayalam": "ഞങ്ങളുടെ പ്രദേശത്ത് കുടിവെള്ളം കിട്ടുന്നില്ല",
}


def _login(email, password="Demo@123"):
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    return r.json()["data"]["access_token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _register_citizen(email):
    r = client.post("/api/auth/register", json={
        "name": "Voice Citizen", "email": email, "password": "Demo@123",
    })
    dev_otp = r.json()["data"]["dev_otp"]
    client.post("/api/auth/verify-otp", json={"email": email, "otp_code": dev_otp})
    return _login(email)


def _fake_groq_post(monkeypatch, payload, capture):
    """Replace the HTTP call Whisper would make, keeping the request the code
    built so the tests can assert on it."""
    def post(url, **kwargs):
        capture["url"] = url
        capture.update(kwargs)
        return SimpleNamespace(
            raise_for_status=lambda: None,
            json=lambda: payload,
        )

    monkeypatch.setattr(speech_service, "requests", SimpleNamespace(post=post))


def _groq_payload(text="No water in our street since morning", language="English"):
    return {
        "text": text,
        "language": language,
        "segments": [{"avg_logprob": -0.2, "no_speech_prob": 0.1}],
    }


def _use_groq(monkeypatch):
    monkeypatch.setattr(settings, "AI_PROVIDER", "groq")
    monkeypatch.setattr(settings, "GROQ_API_KEY", "test-key")


# ---------------------------------------------------------------------------
# 1. Language understanding
# ---------------------------------------------------------------------------

def test_every_supported_indic_script_is_recognised_from_its_own_letters():
    for language, text in WATER_COMPLAINTS.items():
        result = analyze_language(text)
        assert result["language"] == language, text
        assert result["language_code"] == SUPPORTED_LANGUAGES[language]
        assert result["confidence"] > 0.9


def test_plain_english_is_read_as_english_and_not_code_mixed():
    result = analyze_language("There is no water supply in our street for two days.")
    assert result["language"] == "English"
    assert result["code_mixed"] is False


def test_a_regional_word_inside_an_english_sentence_is_reported_as_mixed():
    """An English complaint naming one Tamil word is still English — the
    officer must not get a complaint routed as if it were written in Tamil,
    but the citizen should see that the mixed wording was noticed."""
    result = analyze_language("Water is not coming in our street, தண்ணீர் problem")
    assert result["language"] == "English"
    assert result["code_mixed"] is True
    assert result["mixed_with"] == ["Tamil"]


def test_transliterated_text_is_detected_without_any_regional_script():
    """Half of real voice transcripts, once Whisper renders them in Latin
    letters, look exactly like this."""
    assert analyze_language("garbage bin illa sir, please pannunga")["language"] == "Tamil"
    assert analyze_language("hamare ilake me do din se pani nahi aa raha hai")["language"] == "Hindi"


def test_an_indian_place_name_does_not_turn_english_text_regional():
    """"Chennai" contains "enna", a Tamil function word, and "madurai"
    contains "uri" — cue matching that ignores word boundaries files an
    English complaint as a transliterated one, which is worse than useless
    because the officer then sees a language the citizen never wrote in."""
    for text in (
        "I want to report a broken streetlight in Chennai",
        "There is no water supply in Anna Nagar, Coimbatore since morning",
        "Garbage has not been collected in Mylapore this week",
    ):
        result = analyze_language(text)
        assert result["language"] == "English", text
        assert result["code_mixed"] is False, text


def test_language_name_accepts_a_name_a_code_or_auto():
    assert language_name("Tamil") == "Tamil"
    assert language_name("ml") == "Malayalam"
    assert language_name("Auto") == "English"
    assert language_name(None) == "English"


def test_offline_understanding_keeps_the_citizens_own_words():
    """The test suite runs AI_PROVIDER=mock. Offline mode must not invent an
    English rendering it cannot produce — the local detector still says which
    language it is, and the text travels unchanged."""
    text = WATER_COMPLAINTS["Tamil"]
    result = understand_text(text)
    assert result["language"] == "Tamil"
    assert result["translated"] is False
    assert result["translation_provider"] == "offline"
    assert result["translated_text"] == text


# ---------------------------------------------------------------------------
# 2. Speech-to-text
# ---------------------------------------------------------------------------

def test_transcription_without_a_configured_provider_falls_back_to_mock():
    result = speech_service.transcribe_audio("note.webm", "audio/webm", language="Tamil")
    assert result["provider"] == "mock"
    assert result["needs_text_fallback"] is True
    # The hint is still echoed, so the UI can show what was asked for.
    assert result["language"] == "Tamil"


def test_groq_transcription_reports_words_language_and_confidence(monkeypatch):
    _use_groq(monkeypatch)
    capture = {}
    _fake_groq_post(monkeypatch, _groq_payload("The streetlight near the bus stop is broken"), capture)

    result = speech_service.transcribe_audio(
        "note.webm", "audio/webm", language="Auto", audio_bytes=WEBM_BYTES,
    )

    assert result["provider"] == "groq"
    assert result["transcript"] == "The streetlight near the bus stop is broken"
    assert result["needs_text_fallback"] is False
    # exp(avg_logprob) discounted by the model's own no-speech probability.
    assert result["confidence"] == round(math.exp(-0.2) * 0.9, 3)


def test_auto_detection_asks_with_no_language_at_all(monkeypatch):
    """Live behaviour of the Groq endpoint: when a language is sent, the
    `language` in the response only echoes the hint — so genuine detection
    means sending nothing."""
    _use_groq(monkeypatch)
    capture = {}
    _fake_groq_post(monkeypatch, _groq_payload(language="Tamil"), capture)

    result = speech_service.transcribe_audio("note.webm", "audio/webm", language="Auto", audio_bytes=WEBM_BYTES)

    assert "language" not in capture["data"]
    assert result["language"] == "Tamil"
    assert result["language_detected"] is True


def test_an_explicit_language_is_passed_as_a_hint_and_not_claimed_as_detection(monkeypatch):
    _use_groq(monkeypatch)
    capture = {}
    _fake_groq_post(monkeypatch, _groq_payload(), capture)

    result = speech_service.transcribe_audio("note.webm", "audio/webm", language="Tamil", audio_bytes=WEBM_BYTES)

    assert capture["data"]["language"] == "ta"
    assert result["language"] == "Tamil"
    assert result["language_detected"] is False


def test_a_failing_speech_provider_degrades_to_the_text_fallback(monkeypatch):
    """A misconfigured or unreachable Whisper must never surface as an empty
    transcript the citizen assumes was understood."""
    _use_groq(monkeypatch)

    def post(*args, **kwargs):
        raise RuntimeError("429 rate limited")

    monkeypatch.setattr(speech_service, "requests", SimpleNamespace(post=post))
    result = speech_service.transcribe_audio("note.webm", "audio/webm", audio_bytes=WEBM_BYTES)

    assert result["provider"] == "mock"
    assert result["needs_text_fallback"] is True
    assert result["low_confidence"] is True


def test_low_confidence_transcription_is_flagged(monkeypatch):
    """Noisy recordings still come back with words — the point is that the
    caller is told not to trust them."""
    _use_groq(monkeypatch)
    payload = {"text": "water issue", "language": "English",
               "segments": [{"avg_logprob": -3.0, "no_speech_prob": 0.9}]}
    _fake_groq_post(monkeypatch, payload, {})

    result = speech_service.transcribe_audio("note.webm", "audio/webm", audio_bytes=WEBM_BYTES)

    assert result["confidence"] < settings.VOICE_MIN_CONFIDENCE
    assert result["low_confidence"] is True
    assert result["needs_text_fallback"] is True


def test_silence_is_never_reported_as_a_language_detected_from_the_voice(monkeypatch, tmp_path):
    """Whisper answers "en" for a recording nobody spoke over. That is not a
    reading of anyone's voice, and a caller that takes it as one will read the
    Tamil the citizen typed instead as English — which is what the report form
    does with the hint it is handed."""
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    _use_groq(monkeypatch)
    _fake_groq_post(monkeypatch, {"text": "", "language": "English",
                                  "segments": [{"avg_logprob": -0.1, "no_speech_prob": 0.99}]}, {})

    result = voice_service.transcribe(WEBM_BYTES, "note.webm", "audio/webm", language="Auto", user={})

    assert result["needs_text_fallback"] is True
    assert result["language_detected"] is False
    assert result["transcript"] == ""

    _fake_groq_post(monkeypatch, _groq_payload(), {})
    result = voice_service.transcribe(WEBM_BYTES, "note.webm", "audio/webm", language="Auto", user={})
    assert result["language_detected"] is True
    assert result["transcript"]


# ---------------------------------------------------------------------------
# 3. The voice pipeline and its retention rules
# ---------------------------------------------------------------------------

def test_recording_is_written_only_when_keep_audio_allows(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))

    kept = voice_service.transcribe(WEBM_BYTES, "note.webm", "audio/webm", user={})
    assert kept["audio_url"].startswith("/uploads/")
    assert len(list(tmp_path.iterdir())) == 1

    refused = voice_service.transcribe(
        WEBM_BYTES, "note.webm", "audio/webm",
        user={"voice_preferences": {"keep_audio": False}},
    )
    assert refused["audio_url"] is None
    assert refused["retained"]["audio"] is False
    # Still transcribed: refusing to keep the recording is not refusing to
    # listen to the complaint.
    assert len(list(tmp_path.iterdir())) == 1


def test_placeholder_transcript_is_never_returned_as_the_citizens_words(monkeypatch, tmp_path):
    """The bracketed demo-mode placeholder is an explanation, not a
    transcript — filing it as a grievance would put boilerplate in the
    officer's queue."""
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    result = voice_service.transcribe(WEBM_BYTES, "note.webm", "audio/webm")

    assert result["transcript"] == ""
    assert "[Voice note received" in result["spoken_transcript"]
    assert result["needs_text_fallback"] is True
    assert result["retained"]["verbatim_transcript"] is False
    assert "Type the complaint instead" in result["note"]


def test_a_regional_transcript_is_handed_on_with_its_language_labelled(monkeypatch, tmp_path):
    """Whatever produced the words, the pipeline must still say which
    language they are in, because that drives the reply voice and the
    detected-language badge."""
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    transcript = WATER_COMPLAINTS["Tamil"]

    def fake_transcribe_audio(*args, **kwargs):
        return {
            "transcript": transcript, "language": "Tamil", "language_code": "ta",
            "language_detected": True, "confidence": 0.9, "provider": "groq",
            "needs_text_fallback": False, "low_confidence": False, "note": None,
        }

    monkeypatch.setattr(speech_service, "transcribe_audio", fake_transcribe_audio)
    result = voice_service.transcribe(WEBM_BYTES, "note.webm", "audio/webm")

    assert result["language"] == "Tamil"
    assert result["language_detected"] is True
    assert result["transcribe_confidence"] == 0.9
    assert result["needs_text_fallback"] is False
    assert "Detected Tamil" in voice_service.describe_for_user(result)


def test_rejected_audio_never_reaches_a_speech_provider(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    calls = []
    monkeypatch.setattr(speech_service, "transcribe_audio",
                        lambda *a, **k: calls.append(1))

    for content_type, contents in (
        ("application/x-msdownload", WEBM_BYTES),   # wrong kind of file
        ("audio/webm", b""),                        # empty
    ):
        try:
            voice_service.transcribe(contents, "note", content_type)
        except ValueError as error:
            assert str(error).strip()
        else:
            raise AssertionError(f"{content_type} should not be accepted")

    assert calls == []
    assert list(tmp_path.iterdir()) == []


def test_overlong_upload_is_refused(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    monkeypatch.setattr(settings, "MAX_UPLOAD_MB", 0)

    try:
        voice_service.transcribe(WEBM_BYTES, "note.webm", "audio/webm")
    except ValueError as error:
        assert "upload limit" in str(error)
    else:
        raise AssertionError("an oversized recording must be refused")


def test_deleting_a_conversation_takes_its_recordings_with_it(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    url = speech_service.store_audio(WEBM_BYTES, "a" * 32 + ".webm")
    assert os.path.exists(os.path.join(str(tmp_path), os.path.basename(url)))

    removed = voice_service.purge_session_recordings({
        "messages": [{"role": "user", "text": "x", "audio_url": url}, {"role": "assistant", "text": "y"}],
    })

    assert removed == 1
    assert not os.path.exists(os.path.join(str(tmp_path), os.path.basename(url)))


def test_delete_audio_ignores_anything_outside_the_uploads_directory(monkeypatch, tmp_path):
    """A stored url is user-reachable data, not a trusted path."""
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    outside = tmp_path.parent / "keep_me.webm"
    outside.write_bytes(WEBM_BYTES)

    speech_service.delete_audio(str(outside))
    speech_service.delete_audio("/uploads/../../keep_me.webm")

    assert outside.exists()


# ---------------------------------------------------------------------------
# 4. Endpoints
# ---------------------------------------------------------------------------

def test_voice_status_requires_a_login():
    assert client.get("/api/ai/voice/status").status_code == 401


def test_voice_status_lists_every_language_with_a_speech_locale():
    token = _register_citizen("voicestatus@test.com")
    data = client.get("/api/ai/voice/status", headers=_auth(token)).json()["data"]

    assert [item["name"] for item in data["languages"]] == list(SUPPORTED_LANGUAGES)
    assert all(item["speech_locale"].endswith("-IN") for item in data["languages"])
    assert [i["name"] for i in data["languages"] if i["processing_language"]] == ["English"]
    # Offline test config: no speech key, so the UI must not promise a mic.
    assert data["transcription_available"] is False


def test_voice_transcribe_endpoint_returns_a_reviewable_preview(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    token = _register_citizen("voicetranscribe@test.com")

    r = client.post(
        "/api/ai/voice/transcribe",
        headers=_auth(token),
        files={"file": ("note.webm", WEBM_BYTES, "audio/webm")},
        data={"language": "Auto"},
    )
    assert r.status_code == 200

    data = r.json()["data"]
    assert data["speech_provider"] == "mock"
    assert data["needs_text_fallback"] is True
    assert data["allowed_languages"] == list(SUPPORTED_LANGUAGES)
    assert data["audio_url"].startswith("/uploads/")
    assert os.path.exists(os.path.join(str(tmp_path), os.path.basename(data["audio_url"])))
    assert data["summary"]


def test_voice_transcribe_endpoint_rejects_a_non_audio_upload(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    token = _register_citizen("voicebad@test.com")

    r = client.post(
        "/api/ai/voice/transcribe",
        headers=_auth(token),
        files={"file": ("note.txt", b"just some text", "text/plain")},
    )
    assert r.status_code == 400
    assert list(tmp_path.iterdir()) == []


def _voice_chat(token, message, session_id=None, **extra):
    payload = {"message": message, "language": "Auto", "source": "voice", "session_id": session_id}
    payload.update(extra)
    r = client.post("/api/ai/chat", json=payload, headers=_auth(token))
    assert r.status_code == 200, r.text
    return r.json()["data"]


def test_a_voice_report_is_previewed_then_filed_on_a_spoken_yes():
    """The whole point of the preview: a recording is never filed as a
    complaint until the citizen agrees, and the agreement can come two turns
    and one language later."""
    token = _register_citizen("voicefile@test.com")

    first = _voice_chat(token, "I want to report a broken streetlight in Chennai")
    assert first["awaiting_complaint_confirmation"] is True
    assert first["filed_grievance_id"] is None
    assert [c["name"] for c in first["tool_calls"]] == ["create_complaint"]

    second = _voice_chat(
        token, "yes", session_id=first["session_id"],
        original_text="I want to report a broken streetlight in Chennai",
    )
    assert second["filed_grievance_id"]
    assert second["awaiting_complaint_confirmation"] is False
    # Offline mode has no translation, so it must claim English — a Tamil
    # label on an English sentence would pick the wrong voice for playback.
    assert second["language"] == "English"
    assert second["heard_language"] == "English"

    grievance = grievances_collection.find_one({"grievance_id": second["filed_grievance_id"]})
    assert grievance["district"] == "Chennai"
    assert grievance["reported_language"] == "English"


def test_a_voice_filed_complaint_keeps_the_machine_transcript_only_if_allowed():
    verbatim = "i want to report broken street light chennai"

    token = _register_citizen("voicetranscript@test.com")
    first = _voice_chat(token, "I want to report a broken streetlight in Chennai")
    filed = _voice_chat(token, "yes", session_id=first["session_id"], original_text=verbatim)
    grievance = grievances_collection.find_one({"grievance_id": filed["filed_grievance_id"]})
    assert grievance["voice_transcript"] == verbatim

    refused_token = _register_citizen("voicetranscriptoff@test.com")
    client.put("/api/users/me", json={"voice_preferences": {"keep_transcript": False}},
               headers=_auth(refused_token))
    first = _voice_chat(refused_token, "I want to report a blocked drain in Chennai")
    filed = _voice_chat(refused_token, "yes", session_id=first["session_id"], original_text=verbatim)

    grievance = grievances_collection.find_one({"grievance_id": filed["filed_grievance_id"]})
    assert grievance["voice_transcript"] is None
    # The citizen's approved words still stand — retention governs the
    # machine's guess, never the complaint itself.
    assert grievance["description"] == "I want to report a blocked drain in Chennai"


FORM_LOCATION = {
    "latitude": 13.08, "longitude": 80.27,
    "address": "Test Street, Chennai", "district": "Chennai",
}


def _submit_voice_form(token, **extra):
    """The Report-a-problem form, which is the other way a citizen dictates a
    complaint and so carries the same two machine artifacts."""
    payload = {
        "title": "No water since morning",
        "description": "Our street has had no water supply since yesterday evening.",
        "language": "Auto",
        "location": FORM_LOCATION,
    }
    payload.update(extra)
    r = client.post("/api/grievances/", json=payload, headers=_auth(token))
    assert r.status_code == 200, r.text
    return r.json()["data"]["grievance_id"]


def test_the_voice_form_honours_the_same_retention_settings_as_the_chat(monkeypatch, tmp_path):
    """Retention has to mean the same thing on both routes into the grievance
    system, or it is a promise that breaks depending on which screen the
    citizen happened to be standing on."""
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    issued = f"/uploads/{'ab' * 16}.webm"

    keeping = _register_citizen("voiceformkeep@test.com")
    grievance = grievances_collection.find_one({"grievance_id": _submit_voice_form(
        keeping, voice_transcript="paani nahi aa raha hai", voice_audio_url=issued)})
    assert grievance["voice_transcript"] == "paani nahi aa raha hai"
    assert grievance["voice_audio_url"] == issued

    refusing = _register_citizen("voiceformoff@test.com")
    client.put("/api/users/me",
               headers=_auth(refusing),
               json={"voice_preferences": {"keep_audio": False, "keep_transcript": False}})
    grievance = grievances_collection.find_one({"grievance_id": _submit_voice_form(
        refusing, voice_transcript="paani nahi aa raha hai", voice_audio_url=issued)})
    assert grievance["voice_transcript"] is None
    assert grievance["voice_audio_url"] is None
    # What the citizen approved is the complaint, whatever the switches say.
    assert grievance["description"] == "Our street has had no water supply since yesterday evening."


def test_the_voice_form_never_stores_an_audio_path_it_did_not_issue():
    token = _register_citizen("voiceformforged@test.com")
    grievance = grievances_collection.find_one({"grievance_id": _submit_voice_form(
        token, voice_audio_url="/uploads/../.env")})
    assert grievance["voice_audio_url"] is None


def test_a_regional_complaint_is_stored_without_a_language_field():
    """Real Atlas rejects the insert outright — `language override unsupported:
    Tamil` — because the grievances collection has a TEXT index, and MongoDB
    reads a top-level `language` field on such a collection as a stemmer
    override for a language it does not ship. mongomock has no text indexes, so
    nothing else in this suite can catch a rename back: this is that guard."""
    token = _register_citizen("voiceformtamil@test.com")
    grievance = grievances_collection.find_one({"grievance_id": _submit_voice_form(
        token, language="Tamil",
        description="எங்கள் தெருவில் இரண்டு நாளாக குடிநீர் இல்லை.")})

    assert "language" not in grievance
    assert grievance["reported_language"] == "Tamil"


def test_declining_a_preview_files_nothing_and_clears_the_offer():
    token = _register_citizen("voicecancel@test.com")
    first = _voice_chat(token, "I want to report a blocked drain in Chennai")
    assert first["awaiting_complaint_confirmation"] is True

    second = _voice_chat(token, "no, cancel it", session_id=first["session_id"])
    assert second["filed_grievance_id"] is None
    assert second["awaiting_complaint_confirmation"] is False
    assert "nothing was filed" in second["response"].lower()


def test_a_text_turn_stores_no_voice_metadata():
    token = _register_citizen("voicetextonly@test.com")
    r = client.post("/api/ai/chat", json={"message": "How do I track a complaint?"},
                    headers=_auth(token))
    session = client.get(f"/api/ai/chat/sessions/{r.json()['data']['session_id']}",
                         headers=_auth(token)).json()["data"]
    user_message = session["messages"][0]
    assert "source" not in user_message
    assert "audio_url" not in user_message
    assert "original_text" not in user_message


def test_an_audio_url_the_server_never_issued_is_not_attached_to_the_chat(monkeypatch, tmp_path):
    """The citizen tells us where their recording is; that does not make it a
    path we are willing to reference."""
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    token = _register_citizen("voiceforged@test.com")

    data = _voice_chat(token, "no water in my area in Chennai", audio_url="/uploads/../.env")
    session = client.get(f"/api/ai/chat/sessions/{data['session_id']}", headers=_auth(token)).json()["data"]
    assert "audio_url" not in session["messages"][0]

    issued = f"/uploads/{'ab' * 16}.webm"
    data = _voice_chat(token, "no water in my area in Chennai", audio_url=issued,
                       session_id=data["session_id"])
    session = client.get(f"/api/ai/chat/sessions/{data['session_id']}", headers=_auth(token)).json()["data"]
    assert session["messages"][-2]["audio_url"] == issued


def test_deleting_a_chat_session_over_the_api_reports_the_audio_removed(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    token = _register_citizen("voicedelete@test.com")

    transcription = client.post(
        "/api/ai/voice/transcribe", headers=_auth(token),
        files={"file": ("note.webm", WEBM_BYTES, "audio/webm")},
    ).json()["data"]
    stored = os.path.join(str(tmp_path), os.path.basename(transcription["audio_url"]))
    assert os.path.exists(stored)

    data = _voice_chat(token, "no water in my area in Chennai",
                       audio_url=transcription["audio_url"])
    r = client.delete(f"/api/ai/chat/sessions/{data['session_id']}", headers=_auth(token))

    assert r.json()["data"]["audio_removed"] == 1
    assert not os.path.exists(stored)


def test_a_spoken_grievance_id_is_loosely_matched_and_tracked():
    """Whisper writes "CIV twenty twenty six" as easily as the real thing, so
    a mis-spaced reference still has to find the case."""
    token = _register_citizen("voicetrack@test.com")
    filed = client.post("/api/grievances", json={
        "title": "Overflowing drain on the main road",
        "description": "Sewage water is standing on the street outside our house in Chennai.",
        "language": "Tamil",
        "location": {"latitude": 13.08, "longitude": 80.27,
                     "address": "Test Street, Chennai", "district": "Chennai"},
    }, headers=_auth(token)).json()["data"]

    reply = _voice_chat(token, f"status of {filed['grievance_id'].lower().replace('-', ' ')} please")
    assert reply["tool_calls"][0]["name"] == "check_grievance_status"
    assert filed["grievance_id"] in reply["response"]
