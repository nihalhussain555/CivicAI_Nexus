from datetime import datetime

from bson import ObjectId
from bson.errors import InvalidId

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)

from app.config.database import (
    grievances_collection,
    users_collection,
)

from app.schemas.grievance import (
    GrievanceCreateRequest,
    GrievancePreviewRequest,
    ResolutionSubmitRequest,
    VerificationRequest,
    AssignOfficerRequest,
    FlagInvalidRequest,
    ReopenRequestCreate,
    ReopenReviewRequest,
)

from app.models.grievance import (
    REOPEN_WINDOW_DAYS,
    MAX_REOPEN_REQUESTS,
    DELETABLE_STATUSES,
)

from app.services.ai_pipeline_service import (
    run_pipeline,
)

from app.services.grievance_service import (
    create_grievance,
    get_grievance_or_404,
    assert_can_view,
    transition_status,
    build_list_query,
    paginate,
)

from app.services.copilot_service import (
    build_copilot_brief,
)

from app.services.notification_service import (
    notify,
)

from app.services.audit_service import (
    log_action,
)

from app.services.reward_service import (
    award_officer_verified,
    award_resolved,
    flag_false_report,
    reverse_resolution_points,
    reverse_submission_points,
)

from app.services.incident_service import (
    remove_grievance_from_incident,
)

from app.utils.dependencies import (
    get_current_user,
    require_staff,
)

from app.utils.helpers import (
    serialize_document,
    serialize_documents,
)

from app.utils.geo import make_point


router = APIRouter(
    prefix="/api/grievances",
    tags=["Grievances"],
)


@router.post("/preview")
def preview_analysis(
    data: GrievancePreviewRequest,
    current_user=Depends(
        get_current_user
    ),
):
    location_point = None
    if data.location:
        location_point = make_point(
            data.location.latitude,
            data.location.longitude,
            data.location.address,
        )

    result = run_pipeline(
        f"{data.title}. {data.description}",
        language=data.language,
        citizen_id=current_user["_id"],
        location=location_point,
    )

    result.pop(
        "sla_due_at",
        None,
    )

    return {
        "success": True,
        "data": {
            **result,
            "is_ai_generated": True,
        },
    }


@router.post("/")
def submit_grievance(
    data: GrievanceCreateRequest,
    current_user=Depends(
        get_current_user
    ),
):
    if current_user["role"] != "citizen":
        raise HTTPException(
            status_code=403,
            detail=(
                "Only citizens can "
                "submit grievances"
            ),
        )

    grievance = create_grievance(
        current_user,
        data,
    )

    return {
        "success": True,
        "message":
            "Grievance submitted successfully",
        "data":
            serialize_document(
                grievance
            ),
    }


@router.get("/my")
def my_grievances(
    status: str = None,
    page: int = 1,
    limit: int = 20,
    current_user=Depends(
        get_current_user
    ),
):
    query = build_list_query(
        current_user,
        status=status,
    )

    result = paginate(
        grievances_collection,
        query,
        page,
        limit,
    )

    result["items"] = (
        serialize_documents(
            result["items"]
        )
    )

    return {
        "success": True,
        "data": result,
    }


@router.get("/unassigned")
def unassigned_grievances(
    page: int = 1,
    limit: int = 50,
    department: str = None,
    priority: str = None,
    current_user=Depends(
        get_current_user
    ),
):
    if current_user["role"] != "admin":
        raise HTTPException(
            status_code=403,
            detail=(
                "Only admins can view "
                "unassigned grievances"
            ),
        )

    query = {
        "status":
            "DEPARTMENT_ASSIGNED",
        "assigned_officer": None,
    }

    # District Admin
    if current_user.get("district"):
        query["district"] = (
            current_user["district"]
        )

    if department:
        query["department"] = (
            department
        )

    if priority:
        query["priority"] = (
            priority
        )

    page = max(1, page)
    limit = max(
        1,
        min(100, limit),
    )

    skip = (
        page - 1
    ) * limit

    total = (
        grievances_collection.count_documents(
            query
        )
    )

    items = list(
        grievances_collection.find(
            query
        )
        .sort(
            [
                ("priority_score", -1),
                ("sla_due_at", 1),
            ]
        )
        .skip(skip)
        .limit(limit)
    )

    return {
        "success": True,
        "data": {
            "items":
                serialize_documents(
                    items
                ),
            "total":
                total,
            "page":
                page,
            "limit":
                limit,
            "total_pages":
                max(
                    1,
                    (
                        total +
                        limit -
                        1
                    ) // limit,
                ),
        },
    }


@router.get("/queue")
def priority_queue(
    page: int = 1,
    limit: int = 20,
    current_user=Depends(
        require_staff
    ),
):
    query = {
        "status":
            "DEPARTMENT_ASSIGNED",
        "assigned_officer": None,
    }

    if current_user["role"] == "officer":

        query["department"] = (
            current_user.get(
                "department"
            )
        )

        if current_user.get(
            "district"
        ):
            query["district"] = {
                "$in": [
                    current_user[
                        "district"
                    ],
                    None,
                ]
            }

    items = list(
        grievances_collection.find(
            query
        )
        .sort(
            [
                (
                    "priority_score",
                    -1,
                ),
                (
                    "sla_due_at",
                    1,
                ),
            ]
        )
        .skip(
            max(
                0,
                (page - 1) *
                limit,
            )
        )
        .limit(limit)
    )

    total = (
        grievances_collection.count_documents(
            query
        )
    )

    return {
        "success": True,
        "data": {
            "items":
                serialize_documents(
                    items
                ),
            "total":
                total,
            "page":
                page,
            "limit":
                limit,
        },
    }


@router.get("/assigned")
def my_assigned_cases(
    status: str = None,
    page: int = 1,
    limit: int = 20,
    current_user=Depends(
        require_staff
    ),
):
    query = {
        "assigned_officer":
            current_user["_id"]
    }

    if status:
        query["status"] = status

    result = paginate(
        grievances_collection,
        query,
        page,
        limit,
    )

    result["items"] = (
        serialize_documents(
            result["items"]
        )
    )

    return {
        "success": True,
        "data": result,
    }


@router.get("/")
def list_all_grievances(
    status: str = None,
    category: str = None,
    department: str = None,
    priority: str = None,
    search: str = None,
    page: int = 1,
    limit: int = 20,
    current_user=Depends(
        require_staff
    ),
):
    query = build_list_query(
        current_user,
        status=status,
        category=category,
        department=department,
        priority=priority,
        search=search,
    )

    result = paginate(
        grievances_collection,
        query,
        page,
        limit,
    )

    result["items"] = (
        serialize_documents(
            result["items"]
        )
    )

    return {
        "success": True,
        "data": result,
    }


@router.get("/{grievance_id}")
def get_grievance(
    grievance_id: str,
    current_user=Depends(
        get_current_user
    ),
):
    grievance = (
        get_grievance_or_404(
            grievance_id
        )
    )

    assert_can_view(
        grievance,
        current_user,
    )

    return {
        "success": True,
        "data":
            serialize_document(
                grievance
            ),
    }


@router.get(
    "/{grievance_id}/copilot"
)
def get_copilot_brief(
    grievance_id: str,
    current_user=Depends(
        require_staff
    ),
):
    grievance = (
        get_grievance_or_404(
            grievance_id
        )
    )

    assert_can_view(
        grievance,
        current_user,
    )

    brief = build_copilot_brief(
        grievance
    )

    return {
        "success": True,
        "data": brief,
    }


@router.put(
    "/{grievance_id}/accept"
)
def accept_case(
    grievance_id: str,
    current_user=Depends(
        require_staff
    ),
):
    if current_user["role"] != "officer":
        raise HTTPException(
            status_code=403,
            detail=(
                "Only officers can "
                "take grievances"
            ),
        )

    grievance = (
        get_grievance_or_404(
            grievance_id
        )
    )

    if grievance.get(
        "assigned_officer"
    ):
        raise HTTPException(
            status_code=409,
            detail=(
                "This grievance has "
                "already been assigned"
            ),
        )

    if grievance.get(
        "status"
    ) != "DEPARTMENT_ASSIGNED":
        raise HTTPException(
            status_code=400,
            detail=(
                "This grievance is "
                "not available"
            ),
        )

    if (
        grievance.get("department")
        != current_user.get(
            "department"
        )
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                "This grievance belongs "
                "to another department"
            ),
        )

    if (
        grievance.get("district")
        and current_user.get(
            "district"
        )
        and grievance.get(
            "district"
        )
        != current_user.get(
            "district"
        )
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                "This grievance belongs "
                "to another district"
            ),
        )

    now = datetime.utcnow()

    result = (
        grievances_collection.update_one(
            {
                "grievance_id":
                    grievance_id,
                "status":
                    "DEPARTMENT_ASSIGNED",
                "assigned_officer":
                    None,
            },
            {
                "$set": {
                    "assigned_officer":
                        current_user[
                            "_id"
                        ],
                    "assigned_officer_name":
                        current_user.get(
                            "name"
                        ),
                    "assigned_at":
                        now,
                    "assigned_by":
                        current_user[
                            "_id"
                        ],
                    "assigned_by_name":
                        current_user.get(
                            "name"
                        ),
                    "status":
                        "OFFICER_ACCEPTED",
                    "updated_at":
                        now,
                }
            },
        )
    )

    if result.modified_count == 0:
        raise HTTPException(
            status_code=409,
            detail=(
                "Another officer has "
                "already taken this case"
            ),
        )

    # Civic rewards: +20 the first time a grievance is accepted by an
    # officer — an authority has now treated it as real and actionable.
    award_officer_verified(
        grievance["citizen_id"],
        grievance_id,
        cycle=grievance.get("reopen_count", 0),
    )

    updated = (
        get_grievance_or_404(
            grievance_id
        )
    )

    return {
        "success": True,
        "message":
            "Grievance successfully taken",
        "data":
            serialize_document(
                updated
            ),
    }


@router.put(
    "/{grievance_id}/assign"
)
def assign_officer(
    grievance_id: str,
    data: AssignOfficerRequest,
    current_user=Depends(
        get_current_user
    ),
):
    if current_user["role"] != "admin":
        raise HTTPException(
            status_code=403,
            detail=(
                "Only admins can "
                "assign officers"
            ),
        )

    grievance = (
        get_grievance_or_404(
            grievance_id
        )
    )

    if grievance.get(
        "assigned_officer"
    ):
        raise HTTPException(
            status_code=409,
            detail=(
                "This grievance is "
                "already assigned"
            ),
        )

    if grievance.get(
        "status"
    ) != "DEPARTMENT_ASSIGNED":
        raise HTTPException(
            status_code=400,
            detail=(
                "Only unassigned department "
                "cases can be manually assigned"
            ),
        )

    admin_district = (
        current_user.get(
            "district"
        )
    )

    grievance_district = (
        grievance.get(
            "district"
        )
    )

    if admin_district:

        if (
            grievance_district
            != admin_district
        ):
            raise HTTPException(
                status_code=403,
                detail=(
                    "You can only assign "
                    "grievances from your district"
                ),
            )

    try:
        officer_id = ObjectId(
            data.officer_id
        )
    except (
        InvalidId,
        TypeError,
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid officer ID",
        )

    officer = (
        users_collection.find_one(
            {
                "_id": officer_id,
                "role": "officer",
            },
            {
                "password_hash": 0
            },
        )
    )

    if not officer:
        raise HTTPException(
            status_code=404,
            detail="Officer not found",
        )

    if (
        officer.get("active", True)
        is False
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "This officer is inactive"
            ),
        )

    if (
        officer.get("department")
        != grievance.get(
            "department"
        )
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Officer department does "
                "not match grievance department"
            ),
        )

    if grievance_district:

        if (
            officer.get("district")
            != grievance_district
        ):
            raise HTTPException(
                status_code=400,
                detail=(
                    "Officer district does "
                    "not match grievance district"
                ),
            )

    if admin_district:

        if (
            officer.get("district")
            != admin_district
        ):
            raise HTTPException(
                status_code=403,
                detail=(
                    "You can only assign officers "
                    "from your district"
                ),
            )

    now = datetime.utcnow()

    result = (
        grievances_collection.update_one(
            {
                "grievance_id":
                    grievance_id,
                "status":
                    "DEPARTMENT_ASSIGNED",
                "assigned_officer":
                    None,
            },
            {
                "$set": {
                    "assigned_officer":
                        officer["_id"],
                    "assigned_officer_name":
                        officer.get(
                            "name"
                        ),
                    "assigned_at":
                        now,
                    "assigned_by":
                        current_user[
                            "_id"
                        ],
                    "assigned_by_name":
                        current_user.get(
                            "name"
                        ),
                    "status":
                        "OFFICER_ACCEPTED",
                    "updated_at":
                        now,
                }
            },
        )
    )

    if result.modified_count == 0:
        raise HTTPException(
            status_code=409,
            detail=(
                "This grievance was "
                "already assigned"
            ),
        )

    # Civic rewards: same +20 "verified by authority" trigger as the
    # officer self-take path above.
    award_officer_verified(
        grievance["citizen_id"],
        grievance_id,
        cycle=grievance.get("reopen_count", 0),
    )

    notify(
        officer["_id"],
        "New Grievance Assigned",
        (
            f"Grievance {grievance_id} "
            f"has been assigned to you "
            f"by {current_user.get('name')}."
        ),
        notification_type="INFO",
        related_grievance_id=
            grievance_id,
    )

    updated = (
        get_grievance_or_404(
            grievance_id
        )
    )

    return {
        "success": True,
        "message": (
            f"Grievance assigned to "
            f"{officer.get('name')}"
        ),
        "data":
            serialize_document(
                updated
            ),
    }


@router.put(
    "/{grievance_id}/start"
)
def start_progress(
    grievance_id: str,
    current_user=Depends(
        require_staff
    ),
):
    grievance = (
        get_grievance_or_404(
            grievance_id
        )
    )

    assert_can_view(
        grievance,
        current_user,
    )

    updated = transition_status(
        grievance,
        "IN_PROGRESS",
        current_user,
        message="Work started",
    )

    return {
        "success": True,
        "message":
            "Case moved to in-progress",
        "data":
            serialize_document(
                updated
            ),
    }


@router.put(
    "/{grievance_id}/resolve"
)
def submit_resolution(
    grievance_id: str,
    data: ResolutionSubmitRequest,
    current_user=Depends(
        require_staff
    ),
):
    grievance = (
        get_grievance_or_404(
            grievance_id
        )
    )

    assert_can_view(
        grievance,
        current_user,
    )

    updated = transition_status(
        grievance,
        "RESOLUTION_SUBMITTED",
        current_user,
        message=
            "Officer submitted a resolution",
        extra_fields={
            "resolution_note":
                data.resolution_note,
            "resolution_evidence":
                data.resolution_evidence,
            "resolved_at":
                datetime.utcnow(),
        },
    )

    updated = transition_status(
        updated,
        "CITIZEN_VERIFICATION",
        current_user,
        message=
            "Awaiting citizen verification",
    )

    users_collection.update_one(
        {
            "_id":
                current_user["_id"]
        },
        {
            "$inc": {
                "cases_resolved": 1
            }
        },
    )

    return {
        "success": True,
        "message": (
            "Resolution submitted; "
            "awaiting citizen verification"
        ),
        "data":
            serialize_document(
                updated
            ),
    }


@router.put(
    "/{grievance_id}/escalate"
)
def escalate_case(
    grievance_id: str,
    message: str = None,
    current_user=Depends(
        require_staff
    ),
):
    grievance = (
        get_grievance_or_404(
            grievance_id
        )
    )

    assert_can_view(
        grievance,
        current_user,
    )

    updated = transition_status(
        grievance,
        "ESCALATED",
        current_user,
        message=
            message
            or
            "Escalated for supervisory review",
        extra_fields={
            "escalation_risk":
                "HIGH"
        },
    )

    return {
        "success": True,
        "message":
            "Case escalated",
        "data":
            serialize_document(
                updated
            ),
    }


@router.put(
    "/{grievance_id}/verify"
)
def verify_resolution(
    grievance_id: str,
    data: VerificationRequest,
    current_user=Depends(
        get_current_user
    ),
):
    grievance = (
        get_grievance_or_404(
            grievance_id
        )
    )

    if (
        current_user["role"]
        != "citizen"
        or grievance.get(
            "citizen_id"
        )
        != current_user["_id"]
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                "Only the reporting citizen "
                "can verify this grievance"
            ),
        )

    if data.verified:

        updated = transition_status(
            grievance,
            "CLOSED",
            current_user,
            message=
                "Citizen verified the resolution",
            extra_fields={
                "citizen_verified":
                    True,
                "citizen_feedback":
                    data.feedback,
            },
        )

        # Civic rewards: +30 once the citizen confirms the case is
        # actually resolved — this is the outcome-weighted payoff, not
        # just "an officer said so". Cycle-scoped so a legitimate
        # re-resolution after an approved reopen can earn this again.
        award_resolved(
            grievance["citizen_id"],
            grievance_id,
            cycle=grievance.get("reopen_count", 0),
        )

        return {
            "success": True,
            "message":
                "Grievance closed",
            "data":
                serialize_document(
                    updated
                ),
        }

    updated = transition_status(
        grievance,
        "REOPENED",
        current_user,
        message=
            "Citizen rejected the resolution",
        extra_fields={
            "citizen_verified":
                False,
            "citizen_feedback":
                data.feedback,
            "reopen_count":
                grievance.get(
                    "reopen_count",
                    0,
                ) + 1,
        },
    )

    updated = transition_status(
        updated,
        "DEPARTMENT_ASSIGNED",
        current_user,
        message=(
            "Re-routed to department "
            "after citizen reopened "
            "the case"
        ),
        extra_fields={
            "assigned_officer":
                None,
            "assigned_officer_name":
                None,
            "assigned_at":
                None,
            "assigned_by":
                None,
            "assigned_by_name":
                None,
        },
    )

    return {
        "success": True,
        "message":
            "Grievance reopened",
        "data":
            serialize_document(
                updated
            ),
    }


@router.put("/{grievance_id}/flag-invalid")
def flag_invalid_report(
    grievance_id: str,
    data: FlagInvalidRequest,
    current_user=Depends(require_staff),
):
    """Staff-only: mark a grievance as false or misleading. Reverses any
    civic-reward points already earned for it (idempotent — flagging the
    same case twice only deducts once) and blocks it from earning more."""
    grievance = get_grievance_or_404(grievance_id)
    assert_can_view(grievance, current_user)

    if grievance.get("flagged_invalid"):
        raise HTTPException(
            status_code=400,
            detail="This grievance has already been flagged.",
        )

    now = datetime.utcnow()

    grievances_collection.update_one(
        {"grievance_id": grievance_id},
        {
            "$set": {
                "flagged_invalid": True,
                "flagged_reason": data.reason,
                "flagged_by": current_user["_id"],
                "flagged_at": now,
                "updated_at": now,
            },
            "$push": {
                "history": {
                    "status": grievance["status"],
                    "message": f"Flagged as false/misleading: {data.reason}",
                    "actor_role": current_user["role"],
                    "timestamp": now,
                }
            },
        },
    )

    flag_false_report(grievance, current_user)

    notify(
        grievance["citizen_id"],
        "Grievance Flagged",
        (
            f"Grievance {grievance_id} was reviewed by staff and marked "
            "false or misleading. Any civic points earned for it have "
            "been reversed."
        ),
        notification_type="INFO",
        related_grievance_id=grievance_id,
    )

    log_action(
        current_user["_id"],
        current_user["role"],
        "GRIEVANCE_FLAGGED_INVALID",
        "grievance",
        grievance_id,
        {"reason": data.reason},
    )

    updated = get_grievance_or_404(grievance_id)

    return {
        "success": True,
        "message": "Grievance flagged as false/misleading; points reversed.",
        "data": serialize_document(updated),
    }


@router.post("/{grievance_id}/reopen-request")
def request_reopen(
    grievance_id: str,
    data: ReopenRequestCreate,
    current_user=Depends(get_current_user),
):
    """Citizen asks to reopen a CLOSED case that wasn't actually fixed.
    This does NOT reopen it immediately — it queues a request for staff
    review, so closing a case and instantly re-requesting resolution can't
    be used to farm resolution points twice."""
    grievance = get_grievance_or_404(grievance_id)

    if (
        current_user["role"] != "citizen"
        or grievance.get("citizen_id") != current_user["_id"]
    ):
        raise HTTPException(
            status_code=403,
            detail="Only the reporting citizen can request to reopen this grievance",
        )

    if grievance["status"] != "CLOSED":
        raise HTTPException(
            status_code=400,
            detail="Only a closed grievance can be requested for reopening",
        )

    if grievance.get("reopen_request_status") == "PENDING":
        raise HTTPException(
            status_code=400,
            detail="A reopen request is already pending review for this grievance",
        )

    if grievance.get("reopen_count", 0) >= MAX_REOPEN_REQUESTS:
        raise HTTPException(
            status_code=400,
            detail=f"This grievance has already been reopened the maximum of {MAX_REOPEN_REQUESTS} times",
        )

    anchor = grievance.get("resolved_at") or grievance.get("updated_at")
    if anchor and (datetime.utcnow() - anchor).days > REOPEN_WINDOW_DAYS:
        raise HTTPException(
            status_code=400,
            detail=f"Reopen requests must be made within {REOPEN_WINDOW_DAYS} days of resolution",
        )

    now = datetime.utcnow()

    grievances_collection.update_one(
        {"grievance_id": grievance_id},
        {
            "$set": {
                "reopen_request_status": "PENDING",
                "reopen_reason": data.reason,
                "reopen_requested_at": now,
                "reopen_reviewed_by": None,
                "reopen_reviewed_by_name": None,
                "reopen_reviewed_at": None,
                "reopen_review_note": None,
                "updated_at": now,
            },
            "$push": {
                "history": {
                    "status": grievance["status"],
                    "message": f"Citizen requested to reopen: {data.reason}",
                    "actor_role": "citizen",
                    "timestamp": now,
                }
            },
        },
    )

    assigned_officer = grievance.get("assigned_officer")
    if assigned_officer:
        notify(
            assigned_officer,
            "Reopen Requested",
            f"The citizen has requested to reopen grievance {grievance_id}, saying the issue isn't actually resolved.",
            notification_type="INFO",
            related_grievance_id=grievance_id,
        )

    log_action(
        current_user["_id"],
        current_user["role"],
        "GRIEVANCE_REOPEN_REQUESTED",
        "grievance",
        grievance_id,
        {"reason": data.reason},
    )

    updated = get_grievance_or_404(grievance_id)

    return {
        "success": True,
        "message": "Reopen request submitted; awaiting staff review.",
        "data": serialize_document(updated),
    }


@router.put("/{grievance_id}/reopen-request/review")
def review_reopen_request(
    grievance_id: str,
    data: ReopenReviewRequest,
    current_user=Depends(require_staff),
):
    """Officer/admin approves or rejects a pending reopen request."""
    grievance = get_grievance_or_404(grievance_id)
    assert_can_view(grievance, current_user)

    if grievance.get("reopen_request_status") != "PENDING":
        raise HTTPException(
            status_code=400,
            detail="There is no pending reopen request for this grievance",
        )

    now = datetime.utcnow()

    if data.approve:

        grievances_collection.update_one(
            {"grievance_id": grievance_id},
            {
                "$set": {
                    "reopen_request_status": "APPROVED",
                    "reopen_reviewed_by": current_user["_id"],
                    "reopen_reviewed_by_name": current_user.get("name"),
                    "reopen_reviewed_at": now,
                    "reopen_review_note": data.note,
                }
            },
        )

        # Claw back the +30 "resolved" reward — the case turned out not to
        # actually be fixed, so that outcome-based payoff wasn't earned.
        # Submission and officer-verification points stand; the report
        # itself was still real.
        reverse_resolution_points(grievance)

        grievance = get_grievance_or_404(grievance_id)

        updated = transition_status(
            grievance,
            "REOPENED",
            current_user,
            message=f"Reopen request approved: {data.note or grievance.get('reopen_reason', '')}",
            extra_fields={
                "citizen_verified": None,
                "reopen_count": grievance.get("reopen_count", 0) + 1,
            },
        )

        updated = transition_status(
            updated,
            "DEPARTMENT_ASSIGNED",
            current_user,
            message="Re-routed to department after reopen request was approved",
            extra_fields={
                "assigned_officer": None,
                "assigned_officer_name": None,
                "assigned_at": None,
                "assigned_by": None,
                "assigned_by_name": None,
            },
        )

        log_action(
            current_user["_id"],
            current_user["role"],
            "GRIEVANCE_REOPEN_APPROVED",
            "grievance",
            grievance_id,
            {"note": data.note},
        )

        return {
            "success": True,
            "message": "Reopen request approved; grievance re-routed to the department.",
            "data": serialize_document(updated),
        }

    grievances_collection.update_one(
        {"grievance_id": grievance_id},
        {
            "$set": {
                "reopen_request_status": "REJECTED",
                "reopen_reviewed_by": current_user["_id"],
                "reopen_reviewed_by_name": current_user.get("name"),
                "reopen_reviewed_at": now,
                "reopen_review_note": data.note,
                "updated_at": now,
            },
            "$push": {
                "history": {
                    "status": grievance["status"],
                    "message": f"Reopen request rejected: {data.note or 'No reason given'}",
                    "actor_role": current_user["role"],
                    "timestamp": now,
                }
            },
        },
    )

    notify(
        grievance["citizen_id"],
        "Reopen Request Rejected",
        (
            f"Your request to reopen grievance {grievance_id} was reviewed and declined. "
            + (data.note or "")
        ).strip(),
        notification_type="INFO",
        related_grievance_id=grievance_id,
    )

    log_action(
        current_user["_id"],
        current_user["role"],
        "GRIEVANCE_REOPEN_REJECTED",
        "grievance",
        grievance_id,
        {"note": data.note},
    )

    updated = get_grievance_or_404(grievance_id)

    return {
        "success": True,
        "message": "Reopen request rejected.",
        "data": serialize_document(updated),
    }


@router.delete("/{grievance_id}")
def delete_grievance(
    grievance_id: str,
    current_user=Depends(get_current_user),
):
    """Citizen-only: delete/withdraw a grievance they filed, but ONLY
    before any officer has accepted it. Implemented as a soft delete
    (status -> WITHDRAWN) rather than removing the document, since the
    grievance may already be referenced by the rewards ledger, an
    incident cluster, or audit logs — those need something real to point
    at. Reverses any submission points already earned, so this can't be
    used to farm points on reports that were never actually reviewed."""
    grievance = get_grievance_or_404(grievance_id)

    if current_user["role"] != "citizen" or grievance["citizen_id"] != current_user["_id"]:
        raise HTTPException(
            status_code=403,
            detail="Only the reporting citizen can delete this grievance",
        )

    if grievance["status"] not in DELETABLE_STATUSES or grievance.get("assigned_officer"):
        raise HTTPException(
            status_code=400,
            detail="This grievance can no longer be deleted — an officer has already accepted it",
        )

    updated = transition_status(
        grievance, "WITHDRAWN", current_user,
        message="Deleted by the citizen before officer review",
    )

    reverse_submission_points(grievance)
    remove_grievance_from_incident(grievance)

    log_action(
        current_user["_id"], current_user["role"], "GRIEVANCE_DELETED",
        "grievance", grievance_id, {"status_at_deletion": grievance["status"]},
    )

    return {
        "success": True,
        "message": "Grievance deleted.",
        "data": serialize_document(updated),
    }