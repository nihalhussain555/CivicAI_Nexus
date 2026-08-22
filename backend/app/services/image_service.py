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


def validate_image(content_type: str, size_bytes: int) -> tuple[bool, str]:
    if content_type not in ALLOWED_IMAGE_TYPES:
        return False, f"Unsupported image type '{content_type}'."
    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    if size_bytes > max_bytes:
        return False, f"Image exceeds the {settings.MAX_UPLOAD_MB}MB upload limit."
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
