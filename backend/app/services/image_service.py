"""
Image analysis for multimodal grievance reporting.

MockAIProvider mode returns a deterministic, clearly-labeled description so
the review step always has something to show the citizen before submission.
When AI_PROVIDER=openai or AI_PROVIDER=gemini (and the relevant key is
configured), the actual uploaded image bytes are sent to a vision-capable
model to produce a real caption + detected tags relevant to civic issues.
Any failure transparently falls back to the mock caption so the upload
never breaks the citizen's flow.
"""

import base64

from app.config.settings import settings


ALLOWED_IMAGE_TYPES = settings.ALLOWED_IMAGE_TYPES

VISION_PROMPT = (
    "You are looking at a photo submitted with a civic grievance report "
    "(e.g. garbage, potholes, broken infrastructure, water leaks, damaged "
    "streetlights). In 1-2 short sentences, describe what the photo shows "
    "that's relevant to a civic issue. Then list up to 5 short tags. "
    "Return ONLY JSON: {\"description\": string, \"tags\": [string, ...]}"
)


def sniff_image_format(content: bytes):
    """Identify an image from its actual bytes, not its declared MIME type.

    Returns (content_type, extension) or None when the bytes aren't a
    supported image. Uploads must store an extension derived from this,
    never from the client-supplied filename — an ".svg"/".html" name served
    back from /uploads would execute in the site's own origin.
    """
    if not content:
        return None
    if content.startswith(b"\xff\xd8\xff"):
        return ("image/jpeg", ".jpg")
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return ("image/png", ".png")
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return ("image/webp", ".webp")
    return None


def validate_image(content_type: str, size_bytes: int, content: bytes = None) -> tuple[bool, str]:
    if content_type not in ALLOWED_IMAGE_TYPES:
        return False, f"Unsupported image type '{content_type}'."
    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    if size_bytes > max_bytes:
        return False, f"Image exceeds the {settings.MAX_UPLOAD_MB}MB upload limit."
    if content is not None:
        sniffed = sniff_image_format(content)
        if sniffed is None or sniffed[0] != content_type:
            return False, "File content does not match its declared image type."
    return True, ""


def analyze_image(filename: str, content_type: str, image_bytes: bytes = None) -> dict:
    """
    `image_bytes` is optional so this function still works (in mock mode)
    for callers that only have metadata. Real vision analysis requires the
    actual bytes and a configured provider.
    """
    if image_bytes is not None:
        if settings.AI_PROVIDER == "openai" and settings.OPENAI_API_KEY:
            try:
                return _analyze_with_openai(image_bytes, content_type)
            except Exception as error:  # noqa: BLE001
                print(f"WARNING: OpenAI image analysis failed, using mock: {error}")
        elif settings.AI_PROVIDER == "gemini" and settings.GEMINI_API_KEY:
            try:
                return _analyze_with_gemini(image_bytes, content_type)
            except Exception as error:  # noqa: BLE001
                print(f"WARNING: Gemini image analysis failed, using mock: {error}")

    return {
        "description": (
            "Image attached to grievance. Automatic visual analysis requires a "
            "configured vision-capable AI provider — this is a mock caption for "
            "demo mode."
        ),
        "detected_tags": [],
        "provider": "mock",
    }


def _extract_json(raw_text: str) -> dict:
    import json
    import re

    match = re.search(r"\{.*\}", raw_text, re.DOTALL)
    if not match:
        raise ValueError("No JSON object found in vision response")
    return json.loads(match.group(0))


def _analyze_with_openai(image_bytes: bytes, content_type: str) -> dict:
    from openai import OpenAI

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    b64 = base64.b64encode(image_bytes).decode("utf-8")

    response = client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": VISION_PROMPT},
                    {"type": "image_url", "image_url": {"url": f"data:{content_type};base64,{b64}"}},
                ],
            }
        ],
        temperature=0.2,
    )
    parsed = _extract_json(response.choices[0].message.content)
    return {
        "description": parsed.get("description", ""),
        "detected_tags": parsed.get("tags", []),
        "provider": "openai",
    }


def _analyze_with_gemini(image_bytes: bytes, content_type: str) -> dict:
    import google.generativeai as genai

    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel(settings.GEMINI_MODEL)

    response = model.generate_content([
        VISION_PROMPT,
        {"mime_type": content_type, "data": image_bytes},
    ])
    parsed = _extract_json(response.text)
    return {
        "description": parsed.get("description", ""),
        "detected_tags": parsed.get("tags", []),
        "provider": "gemini",
    }
