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

from app.utils.dependencies import (
    get_current_user,
    require_staff,
)

from app.utils.helpers import (
    serialize_document,
    serialize_documents,
)


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
    result = run_pipeline(
        f"{data.title}. {data.description}",
        language=data.language,
        citizen_id=current_user["_id"],
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