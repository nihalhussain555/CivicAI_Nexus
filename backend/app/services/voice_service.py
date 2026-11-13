"""
The voice pipeline: a recording becomes words, and words become something the
grievance system can act on.

One place owns the three decisions the voice assistant keeps getting asked
about:

1. What was said (`transcribe`) — provider speech-to-text with the language
   read off the audio itself, then the regional-language understanding pass
   that renders it in the processing language.
2. Whether anything is kept (`keep_audio` / `keep_transcript`) — the
   citizen's choice, from their profile, applied before a byte is written to
   disk. Retention is not a cleanup job; a recording we were told not to keep
   is never stored in the first place.
3. What the citizen can still fix — every result carries `needs_text_fallback`
   and `low_confidence`, so the UI offers a correction box instead of filing
   a misheard complaint.

The verbatim machine transcript and the citizen's own corrected words are
different things, and the privacy setting only governs the first one: a
complaint cannot be processed, reviewed or appealed without the words the
citizen actually approved.
"""

import re
import uuid

from app.config.settings import settings
from app.services import speech_service
from app.services.translation_service import (
    PROCESSING_LANGUAGE,
    SUPPORTED_LANGUAGES,
    language_name,
    understand_text,
)


# An audio reference is only ever meaningful if the uploads directory could
# have produced it: a uuid name we issued, with an extension from our own
# whitelist. Everything else — a path someone typed into a request, or one
# pointing outside the uploads mount — is refused before it reaches a document.
_ISSUED_AUDIO = re.compile(r"^/uploads/[0-9a-f]{32}\.(webm|mp3|wav|m4a|ogg|audio)$")


def is_issued_audio_url(url) -> bool:
    return bool(url) and bool(_ISSUED_AUDIO.match(str(url)))


# The citizen-facing defaults. Keeping the recording is what makes a
# transcript auditable for staff, so it is on by default — but it is the
# citizen's switch, not ours.
DEFAULT_VOICE_PREFERENCES = {
    "keep_audio": True,
    "keep_transcript": True,
}

_AUDIO_EXTENSIONS = {
    "audio/webm": ".webm",
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/mp4": ".m4a",
    "audio/m4a": ".m4a",
    "audio/ogg": ".ogg",
}


def voice_preferences(user: dict) -> dict:
    """Merge the account's stored voice settings over the defaults, so a
    profile created before this feature behaves exactly as documented rather
    than as an unfinished object."""
    stored = (user or {}).get("voice_preferences") or {}
    merged = dict(DEFAULT_VOICE_PREFERENCES)
    for key, value in stored.items():
        if key in merged and value is not None:
            merged[key] = bool(value)
    return merged


def validate_audio(content_type: str, size_bytes: int) -> tuple:
    """(is_valid, error) for an uploaded recording.

    Browsers name the same container several ways ("audio/webm" vs
    "audio/webm;codecs=opus"), so the declared type is matched on its prefix."""
    declared = (content_type or "").split(";")[0].strip().lower()
    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024

    if declared not in settings.ALLOWED_AUDIO_TYPES:
        return False, f"Unsupported audio type '{content_type}'."
    if size_bytes > max_bytes:
        return False, f"Audio exceeds the {settings.MAX_UPLOAD_MB}MB upload limit."
    if not size_bytes:
        return False, "Audio file is empty."
    return True, None


def audio_extension(content_type: str, contents: bytes) -> str:
    """Extension from the sniffed container, falling back to the declared
    MIME type — the client-supplied filename is never trusted."""
    declared = (content_type or "").split(";")[0].strip().lower()
    extension = _AUDIO_EXTENSIONS.get(declared)

    if contents[:4] == b"\x1a\x45\xdf\xa3":
        return ".webm"
    if contents[:4] == b"RIFF" and contents[8:12] == b"WAVE":
        return ".wav"
    if contents[:4] == b"OggS":
        return ".ogg"
    return extension or ".audio"


def transcribe(audio_bytes: bytes, filename: str, content_type: str,
               language: str = "Auto", user: dict = None) -> dict:
    """One recording in, a reviewable result out.

    Nothing is written to disk unless the citizen's `keep_audio` allows it;
    the transcription still runs, because hearing the complaint was the
    request — only the retention of the original is theirs to decide."""
    is_valid, error = validate_audio(content_type, len(audio_bytes or b""))
    if not is_valid:
        raise ValueError(error)

    preferences = voice_preferences(user)

    speech = speech_service.transcribe_audio(
        filename or "voice-note.webm",
        content_type,
        language=language,
        audio_bytes=audio_bytes,
    )

    transcript = speech["transcript"]
    understanding = understand_text(transcript, hint=speech["language"])

    audio_url = None
    if preferences["keep_audio"] and audio_bytes:
        safe_name = f"{uuid.uuid4().hex}{audio_extension(content_type, audio_bytes)}"
        audio_url = speech_service.store_audio(audio_bytes, safe_name)

    # A provider that could not run returns a bracketed placeholder; that must
    # never be shown as the citizen's words, and never filed as a complaint.
    is_placeholder = speech.get("provider") == "mock"

    # Silence carries no language. Whisper still answers with "en" for a
    # recording nobody spoke over, and if that is reported as a detection
    # every layer below reads the citizen's typed words in the wrong tongue.
    heard_anything = bool(transcript.strip()) and not is_placeholder

    return {
        "transcript": transcript if not is_placeholder else "",
        "spoken_transcript": transcript,
        "language": understanding["language"],
        "language_code": understanding["language_code"],
        "language_detected": speech["language_detected"] and heard_anything,
        "language_confidence": understanding["confidence"],
        "language_evidence": understanding["evidence"],
        "is_code_mixed": understanding["code_mixed"],
        "processed_text": understanding["translated_text"],
        "was_translated": understanding["translated"],
        "translation_provider": understanding["translation_provider"],
        "transcribe_confidence": speech["confidence"],
        "low_confidence": speech["low_confidence"],
        "needs_text_fallback": speech["needs_text_fallback"] or is_placeholder,
        "speech_provider": speech["provider"],
        # What the citizen has to do about it, not why internally: the reason
        # is already visible as speech_provider="mock".
        "note": None if not is_placeholder else (
            "Speech-to-text is unavailable, so nothing was heard. "
            "Type the complaint instead."
        ),
        "audio_url": audio_url,
        "retained": {
            "audio": bool(audio_url),
            "verbatim_transcript": bool(preferences["keep_transcript"]) and not is_placeholder,
        },
        "allowed_languages": list(SUPPORTED_LANGUAGES),
        "min_confidence": settings.VOICE_MIN_CONFIDENCE,
    }


def describe_for_user(result: dict) -> str:
    """One honest line about what the voice layer did with a recording, for
    the transcription-preview header."""
    parts = []
    if result["language_detected"]:
        parts.append(f"Detected {result['language']} from the audio")
    else:
        parts.append(f"Listened for {result['language']}")
    if result["is_code_mixed"]:
        parts.append("mixed languages")
    if result["was_translated"]:
        parts.append(f"rendered in English by {result['translation_provider']} for processing")
    else:
        parts.append("kept in your own words")
    if result["transcribe_confidence"] is not None:
        parts.append(f"confidence {round(result['transcribe_confidence'] * 100)}%")
    return ", ".join(parts) + "."


def status() -> dict:
    """What the frontend needs to decide whether to offer voice at all, and
    what it must tell the citizen about a language it cannot speak back."""
    provider = settings.AI_PROVIDER
    configured = {
        "groq": bool(settings.GROQ_API_KEY),
        "openai": bool(settings.OPENAI_API_KEY),
        "gemini": bool(settings.GEMINI_API_KEY),
    }.get(provider, False)

    return {
        "speech_provider": provider,
        "transcription_available": configured,
        "stt_model": settings.GROQ_STT_MODEL if provider == "groq" else None,
        "languages": [
            {
                "name": name,
                "code": code,
                # Browser speech synthesis needs a region tag to pick a voice;
                # the platform is Indian, so the Indian locale is the honest
                # default wherever it exists.
                "speech_locale": f"{code}-IN",
                "processing_language": name == PROCESSING_LANGUAGE,
            }
            for name, code in SUPPORTED_LANGUAGES.items()
        ],
        "min_confidence": settings.VOICE_MIN_CONFIDENCE,
        "max_upload_mb": settings.MAX_UPLOAD_MB,
        "allowed_audio_types": settings.ALLOWED_AUDIO_TYPES,
        "available": configured,
    }


def audio_urls_in(session: dict) -> list:
    """Every retained recording referenced by one conversation, so deleting
    the conversation can delete the audio with it."""
    urls = []
    for message in session.get("messages") or []:
        url = message.get("audio_url")
        if url:
            urls.append(url)
    return urls


def purge_session_recordings(session: dict) -> int:
    urls = audio_urls_in(session)
    for url in urls:
        speech_service.delete_audio(url)
    return len(urls)


def normalize_language_hint(value) -> str:
    """Chat/form language field → a supported name or "Auto"."""
    if not value or str(value).strip().lower() in ("auto", ""):
        return "Auto"
    return language_name(value)
