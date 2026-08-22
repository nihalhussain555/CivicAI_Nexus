from fastapi import APIRouter, Depends

from app.config.database import users_collection, grievances_collection
from app.utils.dependencies import require_admin
from app.utils.helpers import serialize_documents


router = APIRouter(prefix="/api/admin", tags=["Administration"])


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
