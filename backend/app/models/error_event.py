from datetime import datetime, timezone
import hashlib

from app.utils.error_catalog import default_fingerprint, redact


def hashed_user_id(user_id):
    """Error events are shared with anyone who can see the admin dashboard, so
    they carry a non-reversible stand-in for the account id rather than the id
    itself. Enough to answer "is one user hitting this repeatedly", useless for
    looking anyone up."""
    return hashlib.sha256(str(user_id).encode("utf-8")).hexdigest()[:24]


def error_event_document(diagnosis, source, message=None, occurred_at=None,
                         user=None, context=None, reported_by_user=False,
                         fingerprint=None, reporter_note=None):
    """Shape of one stored error event.

    `diagnosis` is already redacted by build_diagnosis, so no credential can
    reach the collection; `message` is scrubbed again here because callers
    sometimes pass a raw string alongside it.
    """
    timestamp = occurred_at or datetime.now(timezone.utc).replace(tzinfo=None)
    technical = diagnosis.get("technical") or {}
    return {
        "occurred_at": timestamp,
        "source": source,                      # "backend" | "frontend" | "user_report"
        "category": diagnosis["category"],
        "severity": diagnosis["severity"],
        "feature": diagnosis["feature"],
        "feature_label": diagnosis["feature_label"],
        "message": redact(message or technical.get("message") or diagnosis["what"]),
        "what": diagnosis["what"],
        "reason": diagnosis["reason"],
        "solution": diagnosis["solution"],
        "retryable": diagnosis["retryable"],
        "technical": technical,
        "context": context or {},
        "status": "new",                       # new | triaged | resolved | ignored
        "resolved_at": None,
        "resolved_by": None,
        "reporter_note": reporter_note,
        "reported_by_user": reported_by_user,
        "fingerprint": fingerprint or default_fingerprint(diagnosis, message),
        "user_id_hash": hashed_user_id(user.get("_id")) if user and user.get("_id") else None,
        "user_role": user.get("role") if user else None,
        "created_at": datetime.now(timezone.utc).replace(tzinfo=None),
    }
