from fastapi import APIRouter, Depends, HTTPException, Query

from app.config.database import grievances_collection, users_collection
from app.schemas.grievance import (
    GrievanceCreateRequest,
    GrievancePreviewRequest,
    ResolutionSubmitRequest,
    VerificationRequest,
    AssignOfficerRequest,
)
from app.services.ai_pipeline_service import run_pipeline
from app.services.grievance_service import (
    create_grievance,
    get_grievance_or_404,
    assert_can_view,
    transition_status,
    build_list_query,
    paginate,
)
from app.services.copilot_service import build_copilot_brief
from app.services.notification_service import notify
from app.utils.dependencies import get_current_user, require_staff
from app.utils.helpers import serialize_document, serialize_documents
from datetime import datetime


router = APIRouter(prefix="/api/grievances", tags=["Grievances"])


@router.post("/preview")
def preview_analysis(data: GrievancePreviewRequest, current_user=Depends(get_current_user)):
    """AI Analysis -> Review step: run the pipeline WITHOUT persisting so the
    citizen can review AI predictions before submitting."""
    result = run_pipeline(
        f"{data.title}. {data.description}",
        language=data.language,
        citizen_id=current_user["_id"],
    )
    result.pop("sla_due_at", None)
    return {"success": True, "data": {**result, "is_ai_generated": True}}


@router.post("/")
def submit_grievance(data: GrievanceCreateRequest, current_user=Depends(get_current_user)):
    if current_user["role"] != "citizen":
        raise HTTPException(status_code=403, detail="Only citizens can submit grievances")

    grievance = create_grievance(current_user, data)

    return {
        "success": True,
        "message": "Grievance submitted successfully",
        "data": serialize_document(grievance),
    }


@router.get("/my")
def my_grievances(
    status: str = None,
    page: int = 1,
    limit: int = 20,
    current_user=Depends(get_current_user),
):
    query = build_list_query(current_user, status=status)
    result = paginate(grievances_collection, query, page, limit)
    result["items"] = serialize_documents(result["items"])
    return {"success": True, "data": result}


@router.get("/queue")
def priority_queue(page: int = 1, limit: int = 20, current_user=Depends(require_staff)):
    """Officer priority queue: AI-triaged cases awaiting acceptance in the
    officer's department AND district, sorted by priority then SLA urgency.

    A grievance with no resolvable district (e.g. citizen didn't share a
    location) stays visible to every officer in the matching department —
    we never want a case to become invisible to everyone just because we
    couldn't pin down where it happened.
    """
    query = {"status": "DEPARTMENT_ASSIGNED"}
    if current_user["role"] == "officer":
        query["department"] = current_user.get("department")
        if current_user.get("district"):
            query["district"] = {"$in": [current_user["district"], None]}

    items = list(
        grievances_collection.find(query)
        .sort([("priority_score", -1), ("sla_due_at", 1)])
        .skip(max(0, (page - 1) * limit))
        .limit(limit)
    )
    total = grievances_collection.count_documents(query)

    return {
        "success": True,
        "data": {"items": serialize_documents(items), "total": total, "page": page, "limit": limit},
    }


@router.get("/assigned")
def my_assigned_cases(status: str = None, page: int = 1, limit: int = 20, current_user=Depends(require_staff)):
    query = {"assigned_officer": current_user["_id"]}
    if status:
        query["status"] = status
    result = paginate(grievances_collection, query, page, limit)
    result["items"] = serialize_documents(result["items"])
    return {"success": True, "data": result}


@router.get("/")
def list_all_grievances(
    status: str = None,
    category: str = None,
    department: str = None,
    priority: str = None,
    search: str = None,
    page: int = 1,
    limit: int = 20,
    current_user=Depends(require_staff),
):
    query = build_list_query(
        current_user, status=status, category=category, department=department,
        priority=priority, search=search,
    )
    result = paginate(grievances_collection, query, page, limit)
    result["items"] = serialize_documents(result["items"])
    return {"success": True, "data": result}


@router.get("/{grievance_id}")
def get_grievance(grievance_id: str, current_user=Depends(get_current_user)):
    grievance = get_grievance_or_404(grievance_id)
    assert_can_view(grievance, current_user)
    return {"success": True, "data": serialize_document(grievance)}


@router.get("/{grievance_id}/copilot")
def get_copilot_brief(grievance_id: str, current_user=Depends(require_staff)):
    grievance = get_grievance_or_404(grievance_id)
    brief = build_copilot_brief(grievance)
    return {"success": True, "data": brief}


@router.put("/{grievance_id}/accept")
def accept_case(grievance_id: str, current_user=Depends(require_staff)):
    grievance = get_grievance_or_404(grievance_id)

    if current_user["role"] == "officer":
        if grievance["department"] != current_user.get("department"):
            raise HTTPException(status_code=403, detail="This case belongs to a different department")
        if (
            current_user.get("district")
            and grievance.get("district")
            and grievance["district"] != current_user["district"]
        ):
            raise HTTPException(status_code=403, detail="This case belongs to a different district")

    updated = transition_status(
        grievance, "OFFICER_ACCEPTED", current_user,
        message=f"Accepted by officer {current_user['name']}",
        extra_fields={"assigned_officer": current_user["_id"]},
    )
    return {"success": True, "message": "Case accepted", "data": serialize_document(updated)}


@router.put("/{grievance_id}/assign")
def assign_officer(grievance_id: str, data: AssignOfficerRequest, current_user=Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can manually assign officers")

    from bson import ObjectId
    officer = users_collection.find_one({"_id": ObjectId(data.officer_id), "role": "officer"})
    if not officer:
        raise HTTPException(status_code=404, detail="Officer not found")

    grievance = get_grievance_or_404(grievance_id)
    target_status = "OFFICER_ACCEPTED" if grievance["status"] == "DEPARTMENT_ASSIGNED" else grievance["status"]

    grievances_collection.update_one(
        {"grievance_id": grievance_id},
        {"$set": {"assigned_officer": officer["_id"], "status": target_status, "updated_at": datetime.utcnow()}},
    )
    notify(officer["_id"], "New Case Assigned", f"You have been assigned grievance {grievance_id}.",
           notification_type="INFO", related_grievance_id=grievance_id)

    updated = get_grievance_or_404(grievance_id)
    return {"success": True, "message": "Officer assigned", "data": serialize_document(updated)}


@router.put("/{grievance_id}/start")
def start_progress(grievance_id: str, current_user=Depends(require_staff)):
    grievance = get_grievance_or_404(grievance_id)
    updated = transition_status(grievance, "IN_PROGRESS", current_user, message="Work started")
    return {"success": True, "message": "Case moved to in-progress", "data": serialize_document(updated)}


@router.put("/{grievance_id}/resolve")
def submit_resolution(grievance_id: str, data: ResolutionSubmitRequest, current_user=Depends(require_staff)):
    grievance = get_grievance_or_404(grievance_id)
    updated = transition_status(
        grievance, "RESOLUTION_SUBMITTED", current_user,
        message="Officer submitted a resolution",
        extra_fields={
            "resolution_note": data.resolution_note,
            "resolution_evidence": data.resolution_evidence,
            "resolved_at": datetime.utcnow(),
        },
    )
    # auto-progress to citizen verification
    updated = transition_status(updated, "CITIZEN_VERIFICATION", current_user,
                                 message="Awaiting citizen verification")

    users_collection.update_one({"_id": current_user["_id"]}, {"$inc": {"cases_resolved": 1}})

    return {"success": True, "message": "Resolution submitted; awaiting citizen verification",
            "data": serialize_document(updated)}


@router.put("/{grievance_id}/escalate")
def escalate_case(grievance_id: str, message: str = None, current_user=Depends(require_staff)):
    grievance = get_grievance_or_404(grievance_id)
    updated = transition_status(
        grievance, "ESCALATED", current_user,
        message=message or "Escalated for supervisory review",
        extra_fields={"escalation_risk": "HIGH"},
    )
    return {"success": True, "message": "Case escalated", "data": serialize_document(updated)}


@router.put("/{grievance_id}/verify")
def verify_resolution(grievance_id: str, data: VerificationRequest, current_user=Depends(get_current_user)):
    grievance = get_grievance_or_404(grievance_id)

    if current_user["role"] != "citizen" or grievance["citizen_id"] != current_user["_id"]:
        raise HTTPException(status_code=403, detail="Only the reporting citizen can verify this grievance")

    if data.verified:
        updated = transition_status(
            grievance, "CLOSED", current_user, message="Citizen verified the resolution",
            extra_fields={"citizen_verified": True, "citizen_feedback": data.feedback},
        )
        return {"success": True, "message": "Grievance closed", "data": serialize_document(updated)}

    updated = transition_status(
        grievance, "REOPENED", current_user, message="Citizen rejected the resolution",
        extra_fields={
            "citizen_verified": False,
            "citizen_feedback": data.feedback,
            "reopen_count": grievance.get("reopen_count", 0) + 1,
        },
    )
    # send it back for re-triage
    updated = transition_status(updated, "DEPARTMENT_ASSIGNED", current_user,
                                 message="Re-routed to department after citizen reopened the case")
    return {"success": True, "message": "Grievance reopened", "data": serialize_document(updated)}