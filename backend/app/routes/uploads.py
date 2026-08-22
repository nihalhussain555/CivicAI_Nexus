import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File

from app.config.settings import settings
from app.services.image_service import validate_image, analyze_image
from app.services.speech_service import transcribe_audio
from app.utils.dependencies import get_current_user


router = APIRouter(prefix="/api/uploads", tags=["Uploads"])

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)


@router.post("/image")
async def upload_image(file: UploadFile = File(...), current_user=Depends(get_current_user)):
    contents = await file.read()
    size_bytes = len(contents)

    is_valid, error = validate_image(file.content_type, size_bytes)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error)

    extension = os.path.splitext(file.filename or "")[1] or ".jpg"
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
    contents = await file.read()
    size_bytes = len(contents)

    if file.content_type not in settings.ALLOWED_AUDIO_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported audio type '{file.content_type}'.")
    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    if size_bytes > max_bytes:
        raise HTTPException(status_code=400, detail=f"Audio exceeds the {settings.MAX_UPLOAD_MB}MB upload limit.")

    extension = os.path.splitext(file.filename or "")[1] or ".webm"
    safe_name = f"{uuid.uuid4().hex}{extension}"
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
