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


# Fields only staff may see. Showing a citizen their own authenticity
# breakdown would just teach them which signals to dodge — the same reasoning
# applies to the fingerprint (it reveals what "same wording" means to us) and
# to the trust standing.
# NOTE: flag_appeal_* are deliberately NOT here. A citizen is entitled to know
# their own case was flagged and that an appeal is pending or decided.
STAFF_ONLY_FIELDS = (
    "authenticity",
    "needs_authenticity_review",
    "content_fingerprint",
    "integrity",
)

# Who is handling a case is disclosed to the reporter as a name, a department
# and a date (see tracking_service.build_officer) — being able to ask a named
# person about your file is the accountability the tracking page promises.
# What these entries remove is everything that turns that name into a way of
# reaching or indexing the person: internal account ids, and the convenience
# copies of names for staff actions the citizen is not entitled to (who routed
# the file, who judged it not actionable, who decided to reopen it).
STAFF_IDENTITY_FIELDS = (
    "assigned_officer",
    "assigned_by",
    "assigned_by_name",
    "rejected_by",
    "rejected_by_name",
    "flagged_by",
    "flag_reversed_by",
    "flag_appeal_reviewed_by",
    "reopened_by",
    "reopened_by_name",
)

# Kept separate from the two lists above because it is not a field to remove —
# it is a nested array whose *entries* carry identities and internal visibility.
# Nested arrays need entry-by-entry handling rather than key removal:
# `history` and `remarks` carry both citizen-safe and staff-only rows.
def _public_remark(remark):
    if not isinstance(remark, dict) or remark.get("audience") != "PUBLIC":
        return None
    return {
        "remark_id": remark.get("remark_id"),
        "text": remark.get("text"),
        "created_at": remark.get("created_at"),
        "department": remark.get("department"),
        "author_role": remark.get("author_role"),
    }


def redact_for_citizen(data):
    """Citizen-safe shape of a grievance (or list of them).

    Three rules, applied to every payload a citizen is given:
      * staff-only analysis fields are absent (they teach how to dodge them),
      * individual staff identities are absent (a department is disclosed,
        a person is not),
      * internal log entries and internal shift notes are absent — they stay
        on the document, which is what makes the audit history complete.
    """
    if isinstance(data, list):
        return [redact_for_citizen(item) for item in data]

    if not isinstance(data, dict):
        return data

    safe = {
        key: value
        for key, value in data.items()
        if key not in STAFF_ONLY_FIELDS and key not in STAFF_IDENTITY_FIELDS
    }

    # The reporter's own actions depend on whether anyone has picked the case
    # up yet (see the DELETE endpoint's guard), so that answer has to survive
    # redaction — as a yes/no, not as the officer's account id.
    if "assigned_officer" in data:
        safe["has_assigned_officer"] = bool(data.get("assigned_officer"))

    history = safe.get("history")
    if isinstance(history, list):
        safe["history"] = [
            entry for entry in history
            if isinstance(entry, dict)
            and not (entry.get("visibility") == "internal")
        ]

    remarks = safe.get("remarks")
    if isinstance(remarks, list):
        safe["remarks"] = [
            public for public in (_public_remark(remark) for remark in remarks)
            if public
        ]

    return safe


def strip_staff_fields(data, user):
    """Removes staff-only fields from a serialized grievance (or list of
    them) when the viewer is a citizen. Staff get the data untouched."""
    if not user or user.get("role") != "citizen":
        return data
    return redact_for_citizen(data)