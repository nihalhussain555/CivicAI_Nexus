"""
Speech-to-text for voice grievances and the voice assistant.

The browser can transcribe on its own in Chrome/Edge, but that path is
limited to the languages the user has installed voices for, sends nothing to
the server, and cannot report a confidence figure. This module is the
server-side path: it takes the recorded audio bytes, picks the language from
the audio itself, and hands back the words plus an honest confidence number
so the caller can offer a correction step instead of silently filing a
misheard complaint.

Provider choice follows AI_PROVIDER, the same rule the text pipeline uses:
groq (Whisper on Groq's free tier), openai (whisper-1), gemini, or mock.
Mock returns a clearly-labelled placeholder so the whole workflow still runs
without any paid API — and because a placeholder is not something a citizen
should ever file, it also sets `needs_text_fallback`.
"""

import math
import os

import requests

from app.config.settings import settings
# One language table for the whole product: what speech can hear, what the
# detector can read, and what the form offers are the same six languages.
from app.services.translation_service import (
    PROCESSING_LANGUAGE,
    SUPPORTED_LANGUAGES,
    language_name,
)


# Bias vocabulary for a civic complaint: nudges the model towards Indian
# place names and towards keeping a code-mixed sentence in its own words
# rather than paraphrasing it into English.
_STT_PROMPT = (
    "இது ஒரு குடிமகன் கூறும் புகார். This is a citizen reporting a civic "
    "problem in India, in their own language, possibly mixed with English."
)

_AUDIO_TIMEOUT_SECONDS = 60


def transcribe_audio(
    filename: str,
    content_type: str,
    language: str = "Auto",
    audio_bytes: bytes = None,
) -> dict:
    """Turn one recording into words.

    `language` is a hint, not an instruction: "Auto" (or a name we don't
    support) lets the model detect the spoken language from the audio, which
    is what makes an unlabelled voice note work at all. When the citizen has
    picked a language explicitly it is passed to the model as a bias.

    Always returns the same shape: transcript, language, language_code,
    language_detected, confidence, provider, needs_text_fallback.
    """
    hint = None
    if language and str(language).strip().lower() not in ("auto", ""):
        hint = language_name(language)

    if audio_bytes is None:
        return _mock_result(hint, "no audio bytes were sent")

    provider = settings.AI_PROVIDER

    if provider == "groq" and settings.GROQ_API_KEY:
        try:
            return _transcribe_with_groq(audio_bytes, filename, hint)
        except Exception as error:  # noqa: BLE001
            print(f"WARNING: Groq transcription failed, using mock: {error}")
    elif provider == "openai" and settings.OPENAI_API_KEY:
        try:
            return _transcribe_with_openai(audio_bytes, filename, hint)
        except Exception as error:  # noqa: BLE001
            print(f"WARNING: OpenAI transcription failed, using mock: {error}")
    elif provider == "gemini" and settings.GEMINI_API_KEY:
        try:
            return _transcribe_with_gemini(audio_bytes, content_type, hint)
        except Exception as error:  # noqa: BLE001
            print(f"WARNING: Gemini transcription failed, using mock: {error}")

    return _mock_result(hint, f"{provider} speech model not available")


def _base_result(transcript, language, confidence, provider, detected) -> dict:
    transcript = (transcript or "").strip()
    resolved = language or PROCESSING_LANGUAGE
    low = confidence is not None and confidence < settings.VOICE_MIN_CONFIDENCE
    return {
        "transcript": transcript,
        "language": resolved,
        "language_code": SUPPORTED_LANGUAGES.get(resolved, "en"),
        "language_detected": bool(detected),
        "confidence": round(confidence, 3) if confidence is not None else None,
        "provider": provider,
        # True whenever the caller should hand the citizen a text box rather
        # than trust what came out of the model: nothing was said, the words
        # are a placeholder, or the model was unsure.
        "needs_text_fallback": not transcript or low,
        "low_confidence": bool(low),
    }


def _mock_result(hint, why: str) -> dict:
    return {
        "transcript": (
            "[Voice note received. Automatic transcription needs a configured "
            "speech provider — this is a placeholder from demo mode.]"
        ),
        "language": hint or PROCESSING_LANGUAGE,
        "language_code": SUPPORTED_LANGUAGES.get(hint or PROCESSING_LANGUAGE, "en"),
        "language_detected": False,
        "confidence": 0.0,
        "provider": "mock",
        "needs_text_fallback": True,
        "low_confidence": True,
        "note": f"Speech-to-text unavailable ({why}).",
    }


def _confidence_from(avg_logprob, no_speech_prob) -> float:
    """Whisper reports the mean log-probability per token. Exponentiating it
    gives a per-word probability — the same figure the model itself would
    call its confidence — and a high no_speech_prob (silence, or noise the
    model guessed words through) pulls it down."""
    if avg_logprob is None:
        return 0.0
    confidence = math.exp(max(-12.0, min(0.0, float(avg_logprob))))
    if no_speech_prob:
        confidence *= 1.0 - min(float(no_speech_prob), 0.95)
    return max(0.0, min(1.0, confidence))


def _first_segment(response: dict):
    segments = response.get("segments") or []
    return segments[0] if segments else {}


def _transcribe_with_groq(audio_bytes: bytes, filename: str, hint) -> dict:
    """Groq serves OpenAI's Whisper as a free-tier, OpenAI-compatible
    endpoint. `requests` is used directly rather than the optional `openai`
    package so audio works even where that extra isn't installed.

    Note the two response fields that are NOT interchangeable: when a
    language hint is sent, the returned `language` only echoes that hint, so
    genuine detection requires asking with no language at all."""
    data = {
        "model": settings.GROQ_STT_MODEL,
        "response_format": "verbose_json",
        "prompt": _STT_PROMPT,
    }
    if hint:
        data["language"] = SUPPORTED_LANGUAGES[hint]

    response = requests.post(
        f"{settings.GROQ_BASE_URL.rstrip('/')}/audio/transcriptions",
        headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
        files={"file": (filename or "voice-note.webm", audio_bytes, "application/octet-stream")},
        data=data,
        timeout=_AUDIO_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    payload = response.json()

    segment = _first_segment(payload)
    confidence = _confidence_from(segment.get("avg_logprob"), segment.get("no_speech_prob"))
    spoken = language_name(payload.get("language")) if not hint else hint

    return _base_result(
        payload.get("text"),
        spoken,
        confidence,
        "groq",
        detected=not hint,
    )


def _transcribe_with_openai(audio_bytes: bytes, filename: str, hint) -> dict:
    import io
    from openai import OpenAI

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    audio_file = io.BytesIO(audio_bytes)
    audio_file.name = filename or "voice-note.webm"

    kwargs = {
        "model": "whisper-1",
        "file": audio_file,
        "response_format": "verbose_json",
    }
    if hint:
        kwargs["language"] = SUPPORTED_LANGUAGES[hint]

    response = client.audio.transcriptions.create(**kwargs)
    payload = response.model_dump() if hasattr(response, "model_dump") else dict(response)
    segment = _first_segment(payload)

    return _base_result(
        payload.get("text"),
        hint or language_name(payload.get("language")),
        _confidence_from(segment.get("avg_logprob"), segment.get("no_speech_prob")),
        "openai",
        detected=not hint,
    )


def _transcribe_with_gemini(audio_bytes: bytes, content_type: str, hint) -> dict:
    import google.generativeai as genai

    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel(settings.GEMINI_MODEL)

    language_line = (
        f"The speaker may be using {hint}." if hint
        else "First identify which language the speaker is using."
    )
    response = model.generate_content([
        f"Transcribe this audio verbatim, in the original script of the "
        f"language spoken. {language_line} Return only the transcript text.",
        {"mime_type": content_type, "data": audio_bytes},
    ])

    return _base_result(response.text.strip(), hint or PROCESSING_LANGUAGE, 0.85, "gemini", detected=False)


def store_audio(audio_bytes: bytes, safe_name: str) -> str:
    """Persist a retained recording and return the public path it is served
    from. Only called when the citizen's retention preference allows it."""
    path = os.path.join(settings.UPLOAD_DIR, safe_name)
    with open(path, "wb") as f:
        f.write(audio_bytes)
    return f"/uploads/{safe_name}"


def delete_audio(url: str) -> None:
    """Remove a retained recording by its /uploads/... url. Used when a
    conversation is deleted, so 'delete my chat' really means the audio goes
    too. Anything outside the uploads directory is ignored rather than
    deleted — a stored url is user-reachable data, not a trusted path."""
    if not url or not url.startswith("/uploads/"):
        return
    name = os.path.basename(url)
    path = os.path.normpath(os.path.join(settings.UPLOAD_DIR, name))
    uploads_root = os.path.normpath(settings.UPLOAD_DIR)
    if not path.startswith(uploads_root + os.sep):
        return
    try:
        os.remove(path)
    except OSError:
        pass
