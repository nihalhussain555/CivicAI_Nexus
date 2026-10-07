from datetime import datetime, timedelta

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from app.config.database import (
    users_collection,
    grievances_collection,
)

from app.schemas.admin import OfficerCreateRequest

from app.services.classification_service import (
    CANONICAL_DEPARTMENTS,
    normalize_department,
)

from app.utils.dependencies import (
    require_admin,
    get_current_user,
)

from app.utils.helpers import (
    serialize_document,
    serialize_documents,
)

from app.utils.security import hash_password

from app.models.user import user_document

from fastapi.responses import Response
from app.services.certificate_service import generate_certificate_pdf
from app.services.reward_service import get_officer_badges
from app.models.reward import OFFICER_BADGES


router = APIRouter(
    prefix="/api/officers",
    tags=["Officers"],
)


@router.get("/")
def list_officers(
    department: str = None,
    district: str = None,
    admin=Depends(require_admin),
):
    query = {
        "role": "officer"
    }

    admin_district = admin.get(
        "district"
    )

    # District admin can only see officers
    # belonging to their own district.
    if admin_district:
        query["district"] = admin_district

        if district and district != admin_district:
            raise HTTPException(
                status_code=403,
                detail="You can only view officers from your own district.",
            )

    elif district:
        query["district"] = district

    if department:
        canonical_department = normalize_department(
            department
        )

        if not canonical_department:
            raise HTTPException(
                status_code=400,
                detail="Invalid department.",
            )

        query["department"] = canonical_department

    officers = list(
        users_collection.find(
            query,
            {"password_hash": 0},
        ).sort(
            "name",
            1,
        )
    )

    for officer in officers:
        officer["open_cases"] = (
            grievances_collection.count_documents(
                {
                    "assigned_officer":
                        officer["_id"],
                    "status": {
                        "$nin": ["CLOSED"]
                    },
                }
            )
        )

        officer["cases_resolved"] = (
            grievances_collection.count_documents(
                {
                    "assigned_officer":
                        officer["_id"],
                    "status": "CLOSED",
                }
            )
        )

    return {
        "success": True,
        "data": serialize_documents(
            officers
        ),
    }


@router.post("/")
def create_officer(
    data: OfficerCreateRequest,
    admin=Depends(require_admin),
):
    email = data.email.lower().strip()

    if users_collection.find_one(
        {"email": email}
    ):
        raise HTTPException(
            status_code=400,
            detail="Email is already registered.",
        )

    # ---------------------------------------------------------
    # Canonical department validation
    # ---------------------------------------------------------

    department = normalize_department(
        data.department
    )

    if department not in CANONICAL_DEPARTMENTS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Invalid department. "
                f"Please select one of the "
                f"supported departments."
            ),
        )

    # ---------------------------------------------------------
    # District validation
    # ---------------------------------------------------------

    admin_district = admin.get(
        "district"
    )

    if (
        admin_district
        and data.district != admin_district
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                f"You can only add officers "
                f"within your own district "
                f"({admin_district})."
            ),
        )

    # ---------------------------------------------------------
    # Create officer
    # ---------------------------------------------------------

    officer = user_document(
        name=data.name.strip(),
        email=email,
        password_hash=hash_password(
            data.password
        ),
        role="officer",
        department=department,
        specialization=data.specialization,
        phone=data.phone,
        district=data.district,
    )

    result = users_collection.insert_one(
        officer
    )

    officer["_id"] = result.inserted_id

    officer.pop(
        "password_hash",
        None,
    )

    return {
        "success": True,
        "message": "Officer created successfully.",
        "data": serialize_document(
            officer
        ),
    }


@router.get("/leaderboard")
def officer_leaderboard(limit: int = 10, current_user=Depends(get_current_user)):
    """Ranks officers by cases resolved — mirrors the citizen civic
    rewards leaderboard. Scoped the same way other officer-facing views
    are: an officer sees their department, a district admin sees their
    district, a super admin sees everyone."""
    match_stage = {"assigned_officer": {"$ne": None}}

    if current_user["role"] == "officer":
        match_stage["department"] = current_user.get("department")
    elif current_user["role"] == "admin" and current_user.get("district"):
        match_stage["district"] = current_user["district"]

    pipeline = [
        {"$match": match_stage},
        {"$group": {
            "_id": "$assigned_officer",
            "resolved": {"$sum": {"$cond": [{"$eq": ["$status", "CLOSED"]}, 1, 0]}},
            "total_assigned": {"$sum": 1},
        }},
        {"$match": {"resolved": {"$gt": 0}}},
        {"$sort": {"resolved": -1}},
        {"$limit": max(1, min(50, limit))},
    ]

    rows = list(grievances_collection.aggregate(pipeline))

    leaderboard = []
    for rank, row in enumerate(rows, start=1):
        officer = users_collection.find_one({"_id": row["_id"]}, {"name": 1, "department": 1})
        leaderboard.append({
            "rank": rank,
            "officer_id": row["_id"],
            "name": (officer.get("name") if officer else None) or "Officer",
            "department": officer.get("department") if officer else None,
            "resolved": row["resolved"],
            "total_assigned": row["total_assigned"],
            "resolution_rate": round((row["resolved"] / row["total_assigned"]) * 100) if row["total_assigned"] else 0,
        })

    return {"success": True, "data": serialize_documents(leaderboard)}


@router.get("/me/badges")
def my_officer_badges(current_user=Depends(get_current_user)):
    if current_user["role"] != "officer":
        raise HTTPException(status_code=403, detail="Only officers have performance badges")

    return {"success": True, "data": get_officer_badges(current_user.get("cases_resolved", 0))}


@router.get("/certificate/{badge_key}")
def download_officer_certificate(badge_key: str, current_user=Depends(get_current_user)):
    """Same certificate generator as the citizen reward-tier certificates
    — validated against the officer's own real resolved-case count."""
    if current_user["role"] != "officer":
        raise HTTPException(status_code=403, detail="Only officers can download performance certificates")

    badge = next((b for b in OFFICER_BADGES if b["key"] == badge_key), None)
    if not badge:
        raise HTTPException(status_code=404, detail="Unknown badge")

    resolved = current_user.get("cases_resolved", 0)
    if resolved < badge["target"]:
        raise HTTPException(
            status_code=403,
            detail=f"You need {badge['target']} resolved cases to unlock this certificate — you currently have {resolved}.",
        )

    cert_id = f"OFC-{str(current_user['_id'])[-8:]}-{badge_key}".upper()

    pdf_bytes = generate_certificate_pdf(
        recipient_name=current_user.get("name", "Officer"),
        headline="Certificate of Performance",
        subtitle="CivicAI Nexus — Officer Recognition Program",
        achievement_label=f"Awarded for reaching {badge['label']} — {badge['target']}+ cases resolved",
        cert_id=cert_id,
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="CivicAI_Officer_{badge["key"]}_Certificate.pdf"'},
    )


@router.get("/{officer_id}")
def get_officer(
    officer_id: str,
    admin=Depends(require_admin),
):
    try:
        object_id = ObjectId(
            officer_id
        )
    except Exception:
        raise HTTPException(
            status_code=404,
            detail="Officer not found.",
        )

    officer = users_collection.find_one(
        {
            "_id": object_id,
            "role": "officer",
        },
        {
            "password_hash": 0
        },
    )

    if not officer:
        raise HTTPException(
            status_code=404,
            detail="Officer not found.",
        )

    admin_district = admin.get(
        "district"
    )

    if (
        admin_district
        and officer.get("district")
        != admin_district
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                "You can only view officers "
                "from your own district."
            ),
        )

    officer["open_cases"] = (
        grievances_collection.count_documents(
            {
                "assigned_officer":
                    officer["_id"],
                "status": {
                    "$nin": ["CLOSED"]
                },
            }
        )
    )

    officer["cases_resolved"] = (
        grievances_collection.count_documents(
            {
                "assigned_officer":
                    officer["_id"],
                "status": "CLOSED",
            }
        )
    )

    return {
        "success": True,
        "data": serialize_document(
            officer
        ),
    }


@router.get(
    "/{officer_id}/performance"
)
def officer_performance(
    officer_id: str,
    current_user=Depends(
        get_current_user
    ),
):
    if current_user["role"] != "admin":
        if str(
            current_user["_id"]
        ) != officer_id:
            raise HTTPException(
                status_code=403,
                detail="Access denied.",
            )

    try:
        object_id = ObjectId(
            officer_id
        )
    except Exception:
        raise HTTPException(
            status_code=404,
            detail="Officer not found.",
        )

    officer = users_collection.find_one(
        {
            "_id": object_id,
            "role": "officer",
        }
    )

    if not officer:
        raise HTTPException(
            status_code=404,
            detail="Officer not found.",
        )

    admin_district = current_user.get(
        "district"
    )

    if (
        current_user["role"] == "admin"
        and admin_district
        and officer.get("district")
        != admin_district
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                "You can only view officers "
                "from your own district."
            ),
        )

    total_assigned = (
        grievances_collection.count_documents(
            {
                "assigned_officer":
                    officer["_id"]
            }
        )
    )

    resolved = (
        grievances_collection.count_documents(
            {
                "assigned_officer":
                    officer["_id"],
                "status": "CLOSED",
            }
        )
    )

    open_cases = (
        grievances_collection.count_documents(
            {
                "assigned_officer":
                    officer["_id"],
                "status": {
                    "$nin": ["CLOSED"]
                },
            }
        )
    )

    escalated = (
        grievances_collection.count_documents(
            {
                "assigned_officer":
                    officer["_id"],
                "status": "ESCALATED",
            }
        )
    )

    avg_hours_pipeline = [
        {
            "$match": {
                "assigned_officer":
                    officer["_id"],
                "resolved_at": {
                    "$ne": None
                },
            }
        },
        {
            "$project": {
                "hours": {
                    "$divide": [
                        {
                            "$subtract": [
                                "$resolved_at",
                                "$created_at",
                            ]
                        },
                        1000 * 60 * 60,
                    ]
                }
            }
        },
        {
            "$group": {
                "_id": None,
                "avg_hours": {
                    "$avg": "$hours"
                },
            }
        },
    ]

    avg_agg = list(
        grievances_collection.aggregate(
            avg_hours_pipeline
        )
    )

    avg_resolution_hours = (
        round(
            avg_agg[0]["avg_hours"],
            1,
        )
        if avg_agg
        and avg_agg[0].get(
            "avg_hours"
        ) is not None
        else None
    )

    six_months_ago = (
        datetime.utcnow()
        - timedelta(days=180)
    )

    trend_pipeline = [
        {
            "$match": {
                "assigned_officer":
                    officer["_id"],
                "status": "CLOSED",
                "resolved_at": {
                    "$gte": six_months_ago
                },
            }
        },
        {
            "$group": {
                "_id": {
                    "$dateToString": {
                        "format": "%Y-%m",
                        "date": "$resolved_at",
                    }
                },
                "count": {
                    "$sum": 1
                },
            }
        },
        {
            "$sort": {
                "_id": 1
            }
        },
    ]

    trend = [
        {
            "month": item["_id"],
            "resolved": item["count"],
        }
        for item in grievances_collection.aggregate(
            trend_pipeline
        )
    ]

    recent_cases = list(
        grievances_collection.find(
            {
                "assigned_officer":
                    officer["_id"]
            },
            {
                "grievance_id": 1,
                "title": 1,
                "status": 1,
                "priority": 1,
                "category": 1,
                "updated_at": 1,
            },
        )
        .sort(
            "updated_at",
            -1,
        )
        .limit(6)
    )

    return {
        "success": True,
        "data": {
            "officer_id": officer_id,
            "name": officer.get("name"),
            "email": officer.get("email"),
            "phone": officer.get("phone"),
            "department": officer.get(
                "department"
            ),
            "specialization": officer.get(
                "specialization"
            ),
            "district": officer.get(
                "district"
            ),
            "badge_id": officer.get(
                "badge_id"
            ),
            "created_at": officer.get(
                "created_at"
            ),
            "total_assigned":
                total_assigned,
            "resolved": resolved,
            "open_cases": open_cases,
            "escalated": escalated,
            "resolution_rate": round(
                (
                    resolved
                    / total_assigned
                )
                * 100,
                1,
            )
            if total_assigned
            else 0,
            "avg_resolution_hours":
                avg_resolution_hours,
            "trend": trend,
            "recent_cases":
                serialize_documents(
                    recent_cases
                ),
        },
    }