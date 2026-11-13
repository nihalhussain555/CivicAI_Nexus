from datetime import datetime


def chat_session_document(user_id, title="New chat"):
    now = datetime.utcnow()
    return {
        "user_id": user_id,
        "title": title,
        # Messages are {role, text, created_at} plus, for a turn that came in
        # by voice: `language`, `audio_url` (only while the citizen keeps
        # recordings) and `original_text` (the verbatim transcript, only while
        # they keep transcripts). See voice_service for that rule.
        "messages": [],
        # A complaint the assistant has previewed and not yet been told to
        # file. Kept on the session rather than only in the message text so a
        # spoken "yes, file it" after three other exchanges still files the
        # right thing — and nothing else.
        "pending_complaint": None,
        "created_at": now,
        "updated_at": now,
    }


def make_title(first_message: str) -> str:
    text = " ".join(first_message.strip().split())
    return text[:48] + ("…" if len(text) > 48 else "")