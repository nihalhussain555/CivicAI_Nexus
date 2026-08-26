from datetime import datetime


def chat_session_document(user_id, title="New chat"):
    now = datetime.utcnow()
    return {
        "user_id": user_id,
        "title": title,
        "messages": [],  # [{role: "user"|"assistant", text: str, created_at: datetime}]
        "created_at": now,
        "updated_at": now,
    }


def make_title(first_message: str) -> str:
    text = " ".join(first_message.strip().split())
    return text[:48] + ("…" if len(text) > 48 else "")