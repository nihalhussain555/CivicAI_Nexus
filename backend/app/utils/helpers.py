from datetime import datetime, timezone
import uuid

from bson import ObjectId


def make_complaint_id():
    return f"CIV-{datetime.utcnow():%Y}-{uuid.uuid4().hex[:8].upper()}"


def _stringify_object_ids(value):
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, datetime):
        # Every datetime stored in this app comes from datetime.utcnow(),
        # which is UTC but "naive" (carries no timezone marker). Naive
        # datetimes serialize as e.g. "2026-09-25T14:30:00" with no "Z" or
        # offset — and a browser's `new Date(...)` treats a timestamp with
        # no timezone marker as LOCAL time, not UTC. That silent
        # reinterpretation is exactly what made every timestamp in the
        # app look wrong by the viewer's UTC offset. Attaching UTC
        # explicitly here means the frontend always gets an unambiguous,
        # correctly-marked instant it can convert to the viewer's local
        # time correctly.
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()
    if isinstance(value, list):
        return [_stringify_object_ids(v) for v in value]
    if isinstance(value, dict):
        return {k: _stringify_object_ids(v) for k, v in value.items()}
    return value


def serialize_document(document):
    if not document:
        return None
    return _stringify_object_ids(document)


def serialize_documents(documents):
    return [serialize_document(doc) for doc in documents]