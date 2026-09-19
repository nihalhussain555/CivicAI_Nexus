from datetime import datetime


# Valid grievance lifecycle states (see spec: GRIEVANCE STATES)
GRIEVANCE_STATES = [
    "SUBMITTED",
    "AI_ANALYZED",
    "DEPARTMENT_ASSIGNED",
    "OFFICER_ACCEPTED",
    "IN_PROGRESS",
    "RESOLUTION_SUBMITTED",
    "CITIZEN_VERIFICATION",
    "CLOSED",
    "REOPENED",
    "ESCALATED",
]

# Allowed forward transitions. Kept explicit so the API can reject
# a status change that doesn't make sense for the domain.
VALID_TRANSITIONS = {
    "SUBMITTED": {"AI_ANALYZED"},
    "AI_ANALYZED": {"DEPARTMENT_ASSIGNED"},
    "DEPARTMENT_ASSIGNED": {"OFFICER_ACCEPTED", "ESCALATED"},
    "OFFICER_ACCEPTED": {"IN_PROGRESS", "ESCALATED"},
    "IN_PROGRESS": {"RESOLUTION_SUBMITTED", "ESCALATED"},
    "RESOLUTION_SUBMITTED": {"CITIZEN_VERIFICATION"},
    "CITIZEN_VERIFICATION": {"CLOSED", "REOPENED"},
    "REOPENED": {"DEPARTMENT_ASSIGNED", "OFFICER_ACCEPTED", "IN_PROGRESS"},
    "ESCALATED": {"OFFICER_ACCEPTED", "IN_PROGRESS", "DEPARTMENT_ASSIGNED"},
    # A CLOSED case can only move to REOPENED via an approved reopen
    # request (see routes/grievances.py reopen-request endpoints) — never
    # directly by the citizen, and never back to any other state.
    "CLOSED": {"REOPENED"},
}

# --- Reopen-request policy (guards against gaming the civic rewards
# system by closing then instantly re-requesting a fresh resolution) ---
REOPEN_WINDOW_DAYS = 30      # can only request reopen within this many days of resolution
MAX_REOPEN_REQUESTS = 3      # lifetime cap per grievance


def grievance_document(
    grievance_id,
    citizen_id,
    title,
    description,
    language="English",
    location=None,
    district=None,
):
    now = datetime.utcnow()

    return {
        "grievance_id": grievance_id,
        "citizen_id": citizen_id,

        "title": title,
        "description": description,
        "translated_text": None,
        "language": language,

        # --- AI classification output ---
        "category": "GENERAL",
        "subcategory": None,
        "severity": "LOW",              # LOW | MEDIUM | HIGH | CRITICAL
        "urgency_score": 0,             # 0-100
        "priority": "LOW",              # LOW | MEDIUM | HIGH | CRITICAL
        "priority_score": 0,            # 0-100
        "confidence": 0.0,              # 0-1 AI confidence
        "sentiment": "NEUTRAL",
        "ai_summary": None,
        "recommended_action": None,
        "ai_provider": None,

        # --- duplicate / community intelligence ---
        "duplicate": False,
        "duplicate_score": 0,
        "duplicate_of": None,
        "similar_cases": [],
        "incident_id": None,

        # --- routing ---
        "department": "General Administration",
        "assigned_officer": None,
        "district": district,  # jurisdiction, derived from reverse-geocoded location

        # --- prediction ---
        "predicted_resolution_hours": None,
        "escalation_risk": "LOW",       # LOW | MEDIUM | HIGH
        "sla_due_at": None,

        # --- lifecycle ---
        "status": "SUBMITTED",
        "history": [
            {
                "status": "SUBMITTED",
                "message": "Grievance submitted by citizen",
                "actor_role": "citizen",
                "timestamp": now,
            }
        ],

        # --- multimodal input ---
        "attachments": [],
        "voice_transcript": None,
        "location": location,  # GeoJSON Point: {"type": "Point", "coordinates": [lng, lat]}, "address": str

        # --- resolution / verification ---
        "resolution_note": None,
        "resolution_evidence": [],
        "resolved_at": None,
        "citizen_verified": None,       # True / False / None
        "citizen_feedback": None,
        "reopen_count": 0,

        # --- reopen requests (citizen asking to reopen a CLOSED case) ---
        "reopen_request_status": None,  # None | PENDING | APPROVED | REJECTED
        "reopen_reason": None,
        "reopen_requested_at": None,
        "reopen_reviewed_by": None,
        "reopen_reviewed_by_name": None,
        "reopen_reviewed_at": None,
        "reopen_review_note": None,

        # --- civic rewards integrity flag ---
        "flagged_invalid": False,       # staff-marked false/misleading (blocks further points)
        "flagged_reason": None,
        "flagged_by": None,
        "flagged_at": None,

        "created_at": now,
        "updated_at": now,
    }