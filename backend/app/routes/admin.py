from fastapi import APIRouter, Depends, HTTPException

from app.config.database import users_collection, grievances_collection
from app.models.user import user_document
from app.schemas.admin import AdminCreateRequest
from app.utils.dependencies import require_admin, require_super_admin
from app.utils.helpers import serialize_document, serialize_documents
from app.utils.security import hash_password


router = APIRouter(prefix="/api/admin", tags=["Administration"])


@router.get("/admins")
def list_admins(super_admin=Depends(require_super_admin)):
    """All admin accounts and their district scope — visible only to
    unrestricted super-admins."""
    admins = list(
        users_collection.find({"role": "admin"}, {"password_hash": 0}).sort("name", 1)
    )
    return {"success": True, "data": serialize_documents(admins)}


@router.post("/admins")
def create_admin(data: AdminCreateRequest, super_admin=Depends(require_super_admin)):
    email = data.email.lower().strip()

    if users_collection.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email is already registered")

    admin = user_document(
        name=data.name,
        email=email,
        password_hash=hash_password(data.password),
        role="admin",
        phone=data.phone,
        district=data.district,
    )
    result = users_collection.insert_one(admin)
    admin["_id"] = result.inserted_id

    admin.pop("password_hash")
    return {"success": True, "message": "Admin created", "data": serialize_document(admin)}


@router.get("/users")
def all_users(role: str = None, page: int = 1, limit: int = 20, admin=Depends(require_admin)):
    query = {}
    if role:
        query["role"] = role

    page = max(1, page)
    limit = max(1, min(200, limit))
    skip = (page - 1) * limit

    total = users_collection.count_documents(query)
    users = list(
        users_collection.find(query, {"password_hash": 0})
        .sort("created_at", -1).skip(skip).limit(limit)
    )

    return {
        "success": True,
        "data": {"items": serialize_documents(users), "total": total, "page": page, "limit": limit},
    }


@router.put("/users/{user_id}/deactivate")
def deactivate_user(user_id: str, admin=Depends(require_admin)):
    from bson import ObjectId
    users_collection.update_one({"_id": ObjectId(user_id)}, {"$set": {"active": False}})
    return {"success": True, "message": "User deactivated"}


@router.put("/users/{user_id}/activate")
def activate_user(user_id: str, admin=Depends(require_admin)):
    from bson import ObjectId
    users_collection.update_one({"_id": ObjectId(user_id)}, {"$set": {"active": True}})
    return {"success": True, "message": "User activated"}