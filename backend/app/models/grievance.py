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
    "CLOSED": set(),
}


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

        "created_at": now,
        "updated_at": now,
    }