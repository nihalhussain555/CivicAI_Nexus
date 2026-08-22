from fastapi import APIRouter, Depends, HTTPException

from app.config.database import departments_collection, grievances_collection, users_collection
from app.models.department import department_document
from app.schemas.admin import DepartmentCreateRequest, DepartmentUpdateRequest
from app.utils.dependencies import get_current_user, require_admin
from app.utils.helpers import serialize_document, serialize_documents


router = APIRouter(prefix="/api/departments", tags=["Departments"])


@router.get("/")
def list_departments(current_user=Depends(get_current_user)):
    items = list(departments_collection.find({}).sort("name", 1))

    for item in items:
        item["total_grievances"] = grievances_collection.count_documents({"department": item["name"]})
        item["open_grievances"] = grievances_collection.count_documents(
            {"department": item["name"], "status": {"$nin": ["CLOSED"]}}
        )
        item["officer_count"] = users_collection.count_documents(
            {"role": "officer", "department": item["name"]}
        )

    return {"success": True, "data": serialize_documents(items)}


@router.post("/")
def create_department(data: DepartmentCreateRequest, admin=Depends(require_admin)):
    existing = departments_collection.find_one({"code": data.code.upper()})
    if existing:
        raise HTTPException(status_code=400, detail="Department code already exists")

    department = department_document(
        name=data.name, code=data.code.upper(), description=data.description, categories=data.categories,
    )
    result = departments_collection.insert_one(department)
    department["_id"] = result.inserted_id

    return {"success": True, "message": "Department created", "data": serialize_document(department)}


@router.put("/{code}")
def update_department(code: str, data: DepartmentUpdateRequest, admin=Depends(require_admin)):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = departments_collection.update_one({"code": code.upper()}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Department not found")

    department = departments_collection.find_one({"code": code.upper()})
    return {"success": True, "message": "Department updated", "data": serialize_document(department)}


@router.get("/{code}/performance")
def department_performance(code: str, admin=Depends(require_admin)):
    department = departments_collection.find_one({"code": code.upper()})
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")

    name = department["name"]
    total = grievances_collection.count_documents({"department": name})
    resolved = grievances_collection.count_documents({"department": name, "status": "CLOSED"})
    escalated = grievances_collection.count_documents({"department": name, "status": "ESCALATED"})

    pipeline = [
        {"$match": {"department": name, "resolved_at": {"$ne": None}}},
        {
            "$project": {
                "hours": {
                    "$divide": [
                        {"$subtract": ["$resolved_at", "$created_at"]},
                        1000 * 60 * 60,
                    ]
                }
            }
        },
        {"$group": {"_id": None, "avg_hours": {"$avg": "$hours"}}},
    ]
    agg = list(grievances_collection.aggregate(pipeline))
    avg_hours = round(agg[0]["avg_hours"], 1) if agg else None

    return {
        "success": True,
        "data": {
            "department": name,
            "total_grievances": total,
            "resolved": resolved,
            "escalated": escalated,
            "resolution_rate": round((resolved / total) * 100, 1) if total else 0,
            "avg_resolution_hours": avg_hours,
        },
    }
