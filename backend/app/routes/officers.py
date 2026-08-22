from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from app.config.database import users_collection, grievances_collection, departments_collection
from app.models.user import user_document
from app.schemas.admin import OfficerCreateRequest
from app.utils.dependencies import require_admin, get_current_user
from app.utils.helpers import serialize_document, serialize_documents
from app.utils.security import hash_password


router = APIRouter(prefix="/api/officers", tags=["Officers"])


@router.get("/")
def list_officers(department: str = None, admin=Depends(require_admin)):
    query = {"role": "officer"}
    if department:
        query["department"] = department

    officers = list(users_collection.find(query, {"password_hash": 0}).sort("name", 1))

    for officer in officers:
        officer["open_cases"] = grievances_collection.count_documents(
            {"assigned_officer": officer["_id"], "status": {"$nin": ["CLOSED"]}}
        )

    return {"success": True, "data": serialize_documents(officers)}


@router.post("/")
def create_officer(data: OfficerCreateRequest, admin=Depends(require_admin)):
    email = data.email.lower().strip()

    if users_collection.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email is already registered")

    department = departments_collection.find_one({"name": data.department})
    if not department:
        raise HTTPException(status_code=400, detail="Unknown department. Create the department first.")

    officer = user_document(
        name=data.name,
        email=email,
        password_hash=hash_password(data.password),
        role="officer",
        department=data.department,
        specialization=data.specialization,
        phone=data.phone,
    )
    result = users_collection.insert_one(officer)
    officer["_id"] = result.inserted_id

    departments_collection.update_one({"name": data.department}, {"$inc": {"total_officers": 1}})

    officer.pop("password_hash")
    return {"success": True, "message": "Officer created", "data": serialize_document(officer)}


@router.get("/{officer_id}/performance")
def officer_performance(officer_id: str, current_user=Depends(get_current_user)):
    if current_user["role"] not in ("admin",) and str(current_user["_id"]) != officer_id:
        raise HTTPException(status_code=403, detail="Access denied")

    officer = users_collection.find_one({"_id": ObjectId(officer_id), "role": "officer"})
    if not officer:
        raise HTTPException(status_code=404, detail="Officer not found")

    total_assigned = grievances_collection.count_documents({"assigned_officer": officer["_id"]})
    resolved = grievances_collection.count_documents({"assigned_officer": officer["_id"], "status": "CLOSED"})
    open_cases = grievances_collection.count_documents(
        {"assigned_officer": officer["_id"], "status": {"$nin": ["CLOSED"]}}
    )
    escalated = grievances_collection.count_documents({"assigned_officer": officer["_id"], "status": "ESCALATED"})

    return {
        "success": True,
        "data": {
            "officer_id": officer_id,
            "name": officer["name"],
            "total_assigned": total_assigned,
            "resolved": resolved,
            "open_cases": open_cases,
            "escalated": escalated,
            "resolution_rate": round((resolved / total_assigned) * 100, 1) if total_assigned else 0,
        },
    }
