import uuid
from datetime import datetime

from fastapi import HTTPException

from app.config.database import grievances_collection, users_collection
from app.models.grievance import grievance_document, VALID_TRANSITIONS
from app.services.ai_pipeline_service import run_pipeline
from app.services.incident_service import cluster_grievance
from app.services.notification_service import notify
from app.services.audit_service import log_action
from app.utils.geo import make_point


def make_grievance_id():
    return f"CIV-{datetime.utcnow():%Y}-{uuid.uuid4().hex[:8].upper()}"


def create_grievance(current_user: dict, data) -> dict:
    grievance_id = make_grievance_id()

    location = None
    district = None
    if data.location:
        location = make_point(data.location.latitude, data.location.longitude, data.location.address)
        district = data.location.district

    grievance = grievance_document(
        grievance_id=grievance_id,
        citizen_id=current_user["_id"],
        title=data.title.strip(),
        description=data.description.strip(),
        language=data.language,
        location=location,
        district=district,
    )

    if data.attachments:
        grievance["attachments"] = [a.model_dump() for a in data.attachments]
    if data.voice_transcript:
        grievance["voice_transcript"] = data.voice_transcript

    # --- run full AI pipeline ---
    combined_text = f"{data.title}. {data.description}"
    if data.voice_transcript:
        combined_text += f" {data.voice_transcript}"

    ai_result = run_pipeline(
        combined_text, language=data.language, citizen_id=current_user["_id"], location=location
    )

    now = datetime.utcnow()
    grievance.update({
        "translated_text": ai_result["translated_text"],
        "language": ai_result["detected_language"],

        "category": ai_result["category"],
        "subcategory": ai_result["subcategory"],
        "severity": ai_result["severity"],
        "urgency_score": ai_result["urgency_score"],
        "priority": ai_result["priority"],
        "priority_score": ai_result["priority_score"],
        "confidence": ai_result["confidence"],
        "sentiment": ai_result["sentiment"],
        "ai_summary": ai_result["ai_summary"],
        "recommended_action": ai_result["recommended_action"],
        "ai_provider": ai_result["ai_provider"],

        "department": ai_result["department"],

        "duplicate": ai_result["duplicate"],
        "duplicate_score": ai_result["duplicate_score"],
        "duplicate_of": ai_result["duplicate_of"],
        "similar_cases": ai_result["similar_cases"],

        "predicted_resolution_hours": ai_result["predicted_resolution_hours"],
        "escalation_risk": ai_result["escalation_risk"],
        "sla_due_at": ai_result["sla_due_at"],

        # System auto-progresses SUBMITTED -> AI_ANALYZED -> DEPARTMENT_ASSIGNED
        # immediately after analysis; an officer must still explicitly accept.
        "status": "DEPARTMENT_ASSIGNED",
        "updated_at": now,
    })
    grievance["history"].extend([
        {"status": "AI_ANALYZED", "message": "AI analysis completed", "actor_role": "system", "timestamp": now},
        {
            "status": "DEPARTMENT_ASSIGNED",
            "message": f"Routed to {ai_result['department']} (AI-recommended)",
            "actor_role": "system",
            "timestamp": now,
        },
    ])

    grievances_collection.insert_one(grievance)

    # community incident clustering (requires the grievance to already exist)
    incident = cluster_grievance(grievance)
    if incident:
        grievance["incident_id"] = incident["incident_id"]

    notify(
        current_user["_id"],
        "Grievance Submitted",
        f"Your grievance {grievance_id} was submitted and routed to {ai_result['department']}.",
        notification_type="SUCCESS",
        related_grievance_id=grievance_id,
    )

    log_action(current_user["_id"], current_user["role"], "GRIEVANCE_CREATED", "grievance", grievance_id)

    return grievance


def get_grievance_or_404(grievance_id: str) -> dict:
    grievance = grievances_collection.find_one({"grievance_id": grievance_id})
    if not grievance:
        raise HTTPException(status_code=404, detail="Grievance not found")
    return grievance


def assert_can_view(grievance: dict, current_user: dict):
    if current_user["role"] == "citizen" and grievance["citizen_id"] != current_user["_id"]:
        raise HTTPException(status_code=403, detail="You can only view your own grievances")
    if current_user["role"] == "officer" and grievance.get("assigned_officer") not in (
        None, current_user["_id"],
    ) and grievance.get("department") != current_user.get("department"):
        raise HTTPException(status_code=403, detail="This case is outside your department")


def transition_status(grievance: dict, new_status: str, actor: dict, message: str = None, extra_fields: dict = None):
    current_status = grievance["status"]
    allowed = VALID_TRANSITIONS.get(current_status, set())

    if new_status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition from {current_status} to {new_status}",
        )

    now = datetime.utcnow()
    history_item = {
        "status": new_status,
        "message": message or f"Status changed to {new_status}",
        "actor_role": actor["role"],
        "timestamp": now,
    }

    update_fields = {"status": new_status, "updated_at": now}
    if extra_fields:
        update_fields.update(extra_fields)

    grievances_collection.update_one(
        {"grievance_id": grievance["grievance_id"]},
        {"$set": update_fields, "$push": {"history": history_item}},
    )

    log_action(
        actor["_id"], actor["role"], "GRIEVANCE_STATUS_CHANGE", "grievance",
        grievance["grievance_id"], {"from": current_status, "to": new_status},
    )

    notify(
        grievance["citizen_id"],
        "Grievance Update",
        f"Grievance {grievance['grievance_id']} is now {new_status.replace('_', ' ').title()}.",
        notification_type="STATUS_CHANGE",
        related_grievance_id=grievance["grievance_id"],
    )

    updated = grievances_collection.find_one({"grievance_id": grievance["grievance_id"]})
    return updated


def build_list_query(current_user, status=None, category=None, department=None, priority=None, search=None):
    query = {}

    if current_user["role"] == "citizen":
        query["citizen_id"] = current_user["_id"]
    elif current_user["role"] == "officer":
        query["department"] = current_user.get("department")

    if status:
        query["status"] = status
    if category:
        query["category"] = category
    if department and current_user["role"] == "admin":
        query["department"] = department
    if priority:
        query["priority"] = priority
    if search:
        query["$text"] = {"$search": search}

    return query


def paginate(collection, query, page=1, limit=20, sort_field="created_at", sort_dir=-1):
    page = max(1, page)
    limit = max(1, min(100, limit))
    skip = (page - 1) * limit

    total = collection.count_documents(query)
    items = list(
        collection.find(query).sort(sort_field, sort_dir).skip(skip).limit(limit)
    )

    return {
        "items": items,
        "page": page,
        "limit": limit,
        "total": total,
        "total_pages": (total + limit - 1) // limit if limit else 0,
    }