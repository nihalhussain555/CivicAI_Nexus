"""
Speech-to-text for voice grievance reports.

The frontend VoiceRecorder component transcribes speech client-side via
the browser's SpeechRecognition API where available, so this backend path
is a fallback for raw audio uploads (or browsers without speech support).

MockAIProvider mode returns a clearly-labeled placeholder transcript so the
pipeline still runs end-to-end without any paid API. When AI_PROVIDER is
set to openai/gemini with a configured key, the actual uploaded audio
bytes are transcribed by a real speech model.
"""

from app.config.settings import settings


SUPPORTED_LANGUAGES = {
    "English": "en",
    "Hindi": "hi",
    "Tamil": "ta",
}


def transcribe_audio(filename: str, content_type: str, language: str = "English", audio_bytes: bytes = None) -> dict:
    if audio_bytes is not None:
        if settings.AI_PROVIDER == "openai" and settings.OPENAI_API_KEY:
            try:
                return _transcribe_with_openai(audio_bytes, filename, language)
            except Exception as error:  # noqa: BLE001
                print(f"WARNING: OpenAI transcription failed, using mock: {error}")
        elif settings.AI_PROVIDER == "gemini" and settings.GEMINI_API_KEY:
            try:
                return _transcribe_with_gemini(audio_bytes, content_type, language)
            except Exception as error:  # noqa: BLE001
                print(f"WARNING: Gemini transcription failed, using mock: {error}")

    return {
        "transcript": (
            "[Voice note received. Automatic transcription requires a configured "
            "speech provider — this is a mock transcript for demo mode.]"
        ),
        "language": language,
        "confidence": 0.0,
        "provider": "mock",
    }


def _transcribe_with_openai(audio_bytes: bytes, filename: str, language: str) -> dict:
    import io
    from openai import OpenAI

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    audio_file = io.BytesIO(audio_bytes)
    audio_file.name = filename or "voice-note.webm"

    lang_code = SUPPORTED_LANGUAGES.get(language)
    kwargs = {"model": "whisper-1", "file": audio_file}
    if lang_code:
        kwargs["language"] = lang_code

    response = client.audio.transcriptions.create(**kwargs)

    return {
        "transcript": response.text,
        "language": language,
        "confidence": 0.9,
        "provider": "openai",
    }


def _transcribe_with_gemini(audio_bytes: bytes, content_type: str, language: str) -> dict:
    import google.generativeai as genai

    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel(settings.GEMINI_MODEL)

    response = model.generate_content([
        f"Transcribe this audio verbatim. The speaker may be using {language}. "
        "Return only the transcript text, nothing else.",
        {"mime_type": content_type, "data": audio_bytes},
    ])

    return {
        "transcript": response.text.strip(),
        "language": language,
        "confidence": 0.85,
        "provider": "gemini",
    }
