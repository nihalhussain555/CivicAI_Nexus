from fastapi import APIRouter, Depends, HTTPException

from app.config.database import (
    departments_collection,
    grievances_collection,
    users_collection,
)

from app.models.department import department_document

from app.schemas.admin import (
    DepartmentCreateRequest,
    DepartmentUpdateRequest,
)

from app.utils.constants import (
    DEPARTMENTS,
    DEPARTMENT_CODES,
    DEPARTMENT_TO_CATEGORY,
    DEPARTMENT_ALIASES,
    normalize_department,
)

from app.utils.dependencies import (
    get_current_user,
    require_admin,
)

from app.utils.helpers import (
    serialize_document,
    serialize_documents,
)


router = APIRouter(
    prefix="/api/departments",
    tags=["Departments"],
)


# ============================================================
# DEPARTMENT DESCRIPTIONS
# ============================================================

DEPARTMENT_DESCRIPTIONS = {
    "Municipal Corporation":
        "Municipal civic services and local administration.",

    "Police":
        "Public safety, crime, complaints and law enforcement.",

    "Health":
        "Public health, hospitals, clinics and health services.",

    "Education":
        "Schools, education services and educational facilities.",

    "Electricity":
        "Electricity supply, power failures, poles and electrical issues.",

    "Water Supply":
        "Drinking water supply, pipelines and water distribution.",

    "Roads & Highways":
        "Road damage, potholes, highways and road maintenance.",

    "Sanitation & Waste Management":
        "Garbage collection, waste disposal and sanitation services.",

    "Agriculture":
        "Agriculture, farming and agricultural support services.",

    "Housing":
        "Housing services, housing schemes and residential issues.",

    "Revenue & Land Records":
        "Land records, property records and revenue services.",

    "Food & Civil Supplies":
        "Ration, food distribution and civil supply services.",

    "Transport":
        "Public transport, traffic and transportation services.",

    "Labour & Employment":
        "Employment, labour services and worker-related complaints.",

    "Women & Child Welfare":
        "Women and child welfare services and protection.",

    "Environment & Forest":
        "Environmental protection, pollution and forest services.",

    "Social Welfare":
        "Social welfare schemes and community support services.",

    "Public Works":
        "Public infrastructure and government building maintenance.",

    "Rural Development / Panchayat":
        "Rural infrastructure and Panchayat administration.",

    "e-Governance":
        "Digital government services and online civic services.",

    "Drainage & Sewerage":
        "Drainage, sewage, sewer lines and wastewater management.",
}


# ============================================================
# MIGRATE OLD DEPARTMENT NAMES
# ============================================================

def _migrate_old_department_names():
    """
    Convert old department names in MongoDB to canonical names.

    This is intentionally idempotent and safe to run multiple times.
    """

    for old_name, new_name in DEPARTMENT_ALIASES.items():

        if old_name == new_name:
            continue

        # Update grievances.
        grievances_collection.update_many(
            {"department": old_name},
            {
                "$set": {
                    "department": new_name,
                }
            },
        )

        # Update officers/users.
        users_collection.update_many(
            {
                "role": "officer",
                "department": old_name,
            },
            {
                "$set": {
                    "department": new_name,
                }
            },
        )

        # Remove old department document after references are migrated.
        departments_collection.delete_many(
            {
                "name": old_name,
            }
        )


# ============================================================
# ENSURE CANONICAL DEPARTMENTS
# ============================================================

def _ensure_canonical_departments():
    """
    Make sure all 21 canonical departments exist in MongoDB.
    """

    _migrate_old_department_names()

    for department_name in DEPARTMENTS:

        code = DEPARTMENT_CODES[department_name]

        existing = departments_collection.find_one(
            {
                "$or": [
                    {"name": department_name},
                    {"code": code},
                ]
            }
        )

        if existing:
            departments_collection.update_one(
                {"_id": existing["_id"]},
                {
                    "$set": {
                        "name": department_name,
                        "code": code,
                        "active": True,
                        "description":
                            DEPARTMENT_DESCRIPTIONS.get(
                                department_name,
                                "",
                            ),
                        "categories": [
                            DEPARTMENT_TO_CATEGORY.get(
                                department_name,
                                "GENERAL",
                            )
                        ],
                    }
                },
            )
            continue

        document = department_document(
            name=department_name,
            code=code,
            description=DEPARTMENT_DESCRIPTIONS.get(
                department_name,
                "",
            ),
            categories=[
                DEPARTMENT_TO_CATEGORY.get(
                    department_name,
                    "GENERAL",
                )
            ],
        )

        departments_collection.insert_one(document)


# ============================================================
# LIST
# ============================================================

@router.get("/")
def list_departments(
    current_user=Depends(get_current_user),
):
    _ensure_canonical_departments()

    items = list(
        departments_collection.find(
            {
                "name": {
                    "$in": DEPARTMENTS
                }
            }
        )
    )

    order = {
        name: index
        for index, name in enumerate(DEPARTMENTS)
    }

    items.sort(
        key=lambda item: order.get(
            item.get("name"),
            999,
        )
    )

    for item in items:

        name = normalize_department(
            item.get("name")
        )

        item["name"] = name

        item["total_grievances"] = (
            grievances_collection.count_documents(
                {
                    "department": name
                }
            )
        )

        item["open_grievances"] = (
            grievances_collection.count_documents(
                {
                    "department": name,
                    "status": {
                        "$nin": ["CLOSED"]
                    },
                }
            )
        )

        item["officer_count"] = (
            users_collection.count_documents(
                {
                    "role": "officer",
                    "department": name,
                }
            )
        )

    return {
        "success": True,
        "data": serialize_documents(items),
    }


# ============================================================
# CREATE
# ============================================================

@router.post("/")
def create_department(
    data: DepartmentCreateRequest,
    admin=Depends(require_admin),
):
    requested_name = normalize_department(
        data.name
    )

    if requested_name not in DEPARTMENTS:
        raise HTTPException(
            status_code=400,
            detail=(
                "Only canonical CivicAI departments "
                "are allowed."
            ),
        )

    code = DEPARTMENT_CODES[requested_name]

    existing = departments_collection.find_one(
        {
            "$or": [
                {"name": requested_name},
                {"code": code},
            ]
        }
    )

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Department already exists",
        )

    department = department_document(
        name=requested_name,
        code=code,
        description=(
            data.description
            or DEPARTMENT_DESCRIPTIONS.get(
                requested_name,
                "",
            )
        ),
        categories=[
            DEPARTMENT_TO_CATEGORY.get(
                requested_name,
                "GENERAL",
            )
        ],
    )

    result = departments_collection.insert_one(
        department
    )

    department["_id"] = result.inserted_id

    return {
        "success": True,
        "message": "Department created",
        "data": serialize_document(
            department
        ),
    }


# ============================================================
# UPDATE
# ============================================================

@router.put("/{code}")
def update_department(
    code: str,
    data: DepartmentUpdateRequest,
    admin=Depends(require_admin),
):
    department = departments_collection.find_one(
        {
            "code": code.upper()
        }
    )

    if not department:
        raise HTTPException(
            status_code=404,
            detail="Department not found",
        )

    updates = {
        key: value
        for key, value in data.model_dump().items()
        if value is not None
    }

    if "name" in updates:
        normalized_name = normalize_department(
            updates["name"]
        )

        if normalized_name not in DEPARTMENTS:
            raise HTTPException(
                status_code=400,
                detail="Invalid canonical department name",
            )

        updates["name"] = normalized_name

    if not updates:
        raise HTTPException(
            status_code=400,
            detail="No fields to update",
        )

    result = departments_collection.update_one(
        {
            "_id": department["_id"]
        },
        {
            "$set": updates
        },
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Department not found",
        )

    updated = departments_collection.find_one(
        {
            "_id": department["_id"]
        }
    )

    return {
        "success": True,
        "message": "Department updated",
        "data": serialize_document(
            updated
        ),
    }


# ============================================================
# PERFORMANCE
# ============================================================

@router.get("/{code}/performance")
def department_performance(
    code: str,
    admin=Depends(require_admin),
):
    department = departments_collection.find_one(
        {
            "code": code.upper()
        }
    )

    if not department:
        raise HTTPException(
            status_code=404,
            detail="Department not found",
        )

    name = normalize_department(
        department["name"]
    )

    total = grievances_collection.count_documents(
        {
            "department": name
        }
    )

    resolved = grievances_collection.count_documents(
        {
            "department": name,
            "status": "CLOSED",
        }
    )

    escalated = grievances_collection.count_documents(
        {
            "department": name,
            "status": "ESCALATED",
        }
    )

    pipeline = [
        {
            "$match": {
                "department": name,
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

    aggregate = list(
        grievances_collection.aggregate(
            pipeline
        )
    )

    avg_hours = (
        round(
            aggregate[0]["avg_hours"],
            1,
        )
        if aggregate
        else None
    )

    return {
        "success": True,
        "data": {
            "department": name,
            "total_grievances": total,
            "resolved": resolved,
            "escalated": escalated,
            "resolution_rate": (
                round(
                    (resolved / total) * 100,
                    1,
                )
                if total
                else 0
            ),
            "avg_resolution_hours": avg_hours,
        },
    }