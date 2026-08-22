from datetime import datetime


def complaint_document(
    complaint_id,
    citizen_id,
    original_text,
    language="English"
):
    now = datetime.utcnow()

    return {
        "complaint_id": complaint_id,

        "citizen_id": citizen_id,

        "original_text": original_text,

        "translated_text": None,

        "language": language,

        "category": "GENERAL",

        "department": "General Administration",

        "priority": "LOW",

        "priority_score": 35,

        "sentiment": "NEUTRAL",

        "ai_summary": None,

        "duplicate": False,

        "duplicate_score": 0,

        "duplicate_of": None,

        "status": "SUBMITTED",

        "assigned_officer": None,

        "location": None,

        "evidence": [],

        "history": [
            {
                "status": "SUBMITTED",
                "message": "Complaint submitted successfully",
                "timestamp": now
            }
        ],

        "created_at": now,

        "updated_at": now
    }