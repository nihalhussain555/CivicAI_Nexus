import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File

from app.config.settings import settings
from app.services.image_service import validate_image, analyze_image, sniff_image_format
from app.services.speech_service import transcribe_audio
from app.services.voice_service import audio_extension, validate_audio
from app.utils.dependencies import get_current_user


router = APIRouter(prefix="/api/uploads", tags=["Uploads"])

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

_MAX_BYTES = settings.MAX_UPLOAD_MB * 1024 * 1024


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
    language: str = "Auto",
    current_user=Depends(get_current_user),
):
    # Read one byte past the cap so an oversized recording is rejected without
    # ever being fully buffered in memory.
    contents = await file.read(_MAX_BYTES + 1)

    is_valid, error = validate_audio(file.content_type, len(contents))
    if not is_valid:
        raise HTTPException(status_code=400, detail=error)

    safe_name = f"{uuid.uuid4().hex}{audio_extension(file.content_type, contents)}"
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
            "language": transcript["language"],
            "language_detected": transcript["language_detected"],
            "confidence": transcript["confidence"],
            "needs_text_fallback": transcript["needs_text_fallback"],
            "ai_provider": transcript["provider"],
        },
    }
