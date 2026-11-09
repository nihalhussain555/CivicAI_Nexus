import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File

from app.config.settings import settings
from app.services.image_service import validate_image, analyze_image, sniff_image_format
from app.services.speech_service import transcribe_audio
from app.utils.dependencies import get_current_user


router = APIRouter(prefix="/api/uploads", tags=["Uploads"])

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

_MAX_BYTES = settings.MAX_UPLOAD_MB * 1024 * 1024

# Extension is chosen from the server's own whitelist by the sniffed/declared
# media type — the client-supplied filename is never trusted.
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


@router.post("/image")
async def upload_image(file: UploadFile = File(...), current_user=Depends(get_current_user)):
    # Read one byte past the cap so oversized files are rejected without
    # ever being fully buffered in memory.
    contents = await file.read(_MAX_BYTES + 1)
    size_bytes = len(contents)

    is_valid, error = validate_image(file.content_type, size_bytes, content=contents)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error)

    _, extension = sniff_image_format(contents)
    safe_name = f"{uuid.uuid4().hex}{extension}"
    path = os.path.join(settings.UPLOAD_DIR, safe_name)

    with open(path, "wb") as f:
        f.write(contents)

    ai_caption = analyze_image(file.filename or safe_name, file.content_type, image_bytes=contents)

    return {
        "success": True,
        "data": {
            "url": f"/uploads/{safe_name}",
            "type": "image",
            "filename": file.filename,
            "ai_description": ai_caption["description"],
            "ai_tags": ai_caption.get("detected_tags", []),
            "ai_provider": ai_caption.get("provider", "mock"),
        },
    }


@router.post("/audio")
async def upload_audio(
    file: UploadFile = File(...),
    language: str = "English",
    current_user=Depends(get_current_user),
):
    contents = await file.read(_MAX_BYTES + 1)
    size_bytes = len(contents)

    # Browsers vary how they name the same container ("audio/webm" vs
    # "audio/webm;codecs=opus" vs "audio/ogg"), so match the declared type
    # against the whitelist prefix-wise and derive the extension from the
    # sniffed bytes when possible.
    declared_type = (file.content_type or "").split(";")[0].strip().lower()
    if declared_type not in settings.ALLOWED_AUDIO_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported audio type '{file.content_type}'.")
    if size_bytes > _MAX_BYTES:
        raise HTTPException(status_code=400, detail=f"Audio exceeds the {settings.MAX_UPLOAD_MB}MB upload limit.")
    if not contents:
        raise HTTPException(status_code=400, detail="Audio file is empty.")

    extension = _AUDIO_EXTENSIONS.get(declared_type)
    if contents[:4] == b"\x1a\x45\xdf\xa3":
        extension = ".webm"
    elif contents[:4] == b"RIFF" and contents[8:12] == b"WAVE":
        extension = ".wav"
    elif contents[:4] == b"OggS":
        extension = ".ogg"

    safe_name = f"{uuid.uuid4().hex}{extension or '.audio'}"
    path = os.path.join(settings.UPLOAD_DIR, safe_name)

    with open(path, "wb") as f:
        f.write(contents)

    transcript = transcribe_audio(
        file.filename or safe_name, file.content_type, language=language, audio_bytes=contents,
    )

    return {
        "success": True,
        "data": {
            "url": f"/uploads/{safe_name}",
            "type": "audio",
            "filename": file.filename,
            "transcript": transcript["transcript"],
            "ai_provider": transcript.get("provider", "mock"),
        },
    }
