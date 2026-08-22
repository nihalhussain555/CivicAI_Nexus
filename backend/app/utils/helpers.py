from datetime import datetime
import uuid

from bson import ObjectId


def make_complaint_id():
    return f"CIV-{datetime.utcnow():%Y}-{uuid.uuid4().hex[:8].upper()}"


def _stringify_object_ids(value):
    if isinstance(value, ObjectId):
        return str(value)
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
