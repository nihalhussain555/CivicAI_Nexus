from bson import ObjectId
from bson.errors import InvalidId

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)

from app.config.database import (
    users_collection,
    grievances_collection,
    departments_collection,
)

from app.models.user import user_document

from app.schemas.admin import (
    OfficerCreateRequest,
)

from app.utils.constants import (
    DEPARTMENTS,
    DEPARTMENT_ALIASES,
    DISTRICTS,
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


router = APIRouter(
    prefix="/api/officers",
    tags=["Officers"],
)


# ============================================================
# VALIDATE DEPARTMENT
# ============================================================

def _validate_department(value):
    if not value:
        raise HTTPException(
            status_code=400,
            detail="Department is required",
        )

    department = normalize_department(
        value
    )

    if department not in DEPARTMENTS:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid department. "
                "Select a department from the "
                "CivicAI department list."
            ),
        )

    return department


# ============================================================
# LIST OFFICERS
# ============================================================

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

    # --------------------------------------------------------
    # DISTRICT ADMIN
    # --------------------------------------------------------

    if admin_district:

        if (
            district
            and district != admin_district
        ):
            raise HTTPException(
                status_code=403,
                detail=(
                    "You can only view officers "
                    "from your own district"
                ),
            )

        query["district"] = admin_district

    # --------------------------------------------------------
    # SUPER ADMIN
    # --------------------------------------------------------

    elif district:
        if district not in DISTRICTS:
            raise HTTPException(
                status_code=400,
                detail="Invalid district",
            )

        query["district"] = district

    # --------------------------------------------------------
    # DEPARTMENT
    # --------------------------------------------------------

    if department:
        department = _validate_department(
            department
        )

        query["department"] = department

    officers = list(
        users_collection.find(
            query,
            {
                "password_hash": 0
            },
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
                        "$nin": [
                            "CLOSED"
                        ]
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

        officer["department"] = normalize_department(
            officer.get("department")
        )

    return {
        "success": True,
        "data": serialize_documents(
            officers
        ),
    }


# ============================================================
# CREATE OFFICER
# ============================================================

@router.post("/")
def create_officer(
    data: OfficerCreateRequest,
    admin=Depends(require_admin),
):
    email = (
        data.email
        .lower()
        .strip()
    )

    if users_collection.find_one(
        {
            "email": email
        }
    ):
        raise HTTPException(
            status_code=400,
            detail="Email is already registered",
        )

    # --------------------------------------------------------
    # DEPARTMENT MUST BE CANONICAL
    # --------------------------------------------------------

    department = _validate_department(
        data.department
    )

    department_document = (
        departments_collection.find_one(
            {
                "name": department
            }
        )
    )

    if not department_document:
        raise HTTPException(
            status_code=400,
            detail=(
                "Department is not available. "
                "Refresh the department list."
            ),
        )

    # --------------------------------------------------------
    # DISTRICT VALIDATION
    # --------------------------------------------------------

    if data.district not in DISTRICTS:
        raise HTTPException(
            status_code=400,
            detail="Invalid district",
        )

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
                "You can only create officers "
                f"inside {admin_district}"
            ),
        )

    # --------------------------------------------------------
    # CREATE OFFICER
    # --------------------------------------------------------

    officer = user_document(
        name=data.name.strip(),
        email=email,
        password_hash=hash_password(
            data.password
        ),
        role="officer",
        department=department,
        specialization=(
            data.specialization.strip()
            if data.specialization
            else None
        ),
        phone=(
            data.phone.strip()
            if data.phone
            else None
        ),
        district=data.district,
    )

    result = users_collection.insert_one(
        officer
    )

    officer["_id"] = result.inserted_id

    # --------------------------------------------------------
    # UPDATE OFFICER COUNT
    # --------------------------------------------------------

    departments_collection.update_one(
        {
            "name": department
        },
        {
            "$inc": {
                "total_officers": 1
            }
        },
    )

    officer.pop(
        "password_hash",
        None,
    )

    return {
        "success": True,
        "message": "Officer created",
        "data": serialize_document(
            officer
        ),
    }


# ============================================================
# GET OFFICER
# ============================================================

@router.get("/{officer_id}")
def get_officer(
    officer_id: str,
    admin=Depends(require_admin),
):
    try:
        object_id = ObjectId(
            officer_id
        )
    except (
        InvalidId,
        TypeError,
    ):
        raise HTTPException(
            status_code=404,
            detail="Officer not found",
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
            detail="Officer not found",
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
                "You cannot view officers "
                "outside your district"
            ),
        )

    officer["department"] = normalize_department(
        officer.get("department")
    )

    officer["open_cases"] = (
        grievances_collection.count_documents(
            {
                "assigned_officer":
                    officer["_id"],
                "status": {
                    "$nin": [
                        "CLOSED"
                    ]
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


# ============================================================
# OFFICER PERFORMANCE
# ============================================================

@router.get("/{officer_id}/performance")
def officer_performance(
    officer_id: str,
    current_user=Depends(
        get_current_user
    ),
):
    try:
        object_id = ObjectId(
            officer_id
        )
    except (
        InvalidId,
        TypeError,
    ):
        raise HTTPException(
            status_code=404,
            detail="Officer not found",
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
            detail="Officer not found",
        )

    if (
        current_user["role"] == "admin"
        and current_user.get("district")
        and officer.get("district")
        != current_user.get("district")
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                "You cannot view officers "
                "outside your district"
            ),
        )

    officer_id = officer["_id"]

    total = grievances_collection.count_documents(
        {
            "assigned_officer": officer_id
        }
    )

    resolved = grievances_collection.count_documents(
        {
            "assigned_officer": officer_id,
            "status": "CLOSED",
        }
    )

    open_cases = grievances_collection.count_documents(
        {
            "assigned_officer": officer_id,
            "status": {
                "$nin": [
                    "CLOSED"
                ]
            },
        }
    )

    return {
        "success": True,
        "data": {
            "officer_id": str(
                officer_id
            ),
            "department": normalize_department(
                officer.get("department")
            ),
            "district": officer.get(
                "district"
            ),
            "total_cases": total,
            "resolved_cases": resolved,
            "open_cases": open_cases,
            "resolution_rate": (
                round(
                    resolved / total * 100,
                    1,
                )
                if total
                else 0
            ),
        },
    }