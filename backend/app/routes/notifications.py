from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException

from app.config.database import notifications_collection
from app.utils.dependencies import get_current_user
from app.utils.helpers import serialize_document, serialize_documents
from bson import ObjectId


router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


@router.get("/")
def list_notifications(unread_only: bool = False, page: int = 1, limit: int = 20,
                        current_user=Depends(get_current_user)):
    query = {"user_id": current_user["_id"]}
    if unread_only:
        query["read"] = False

    page = max(1, page)
    limit = max(1, min(100, limit))
    skip = (page - 1) * limit

    total = notifications_collection.count_documents(query)
    unread_count = notifications_collection.count_documents({"user_id": current_user["_id"], "read": False})
    items = list(notifications_collection.find(query).sort("created_at", -1).skip(skip).limit(limit))

    return {
        "success": True,
        "data": {
            "items": serialize_documents(items),
            "total": total,
            "unread_count": unread_count,
            "page": page,
            "limit": limit,
        },
    }


@router.put("/{notification_id}/read")
def mark_read(notification_id: str, current_user=Depends(get_current_user)):
    result = notifications_collection.update_one(
        {"_id": ObjectId(notification_id), "user_id": current_user["_id"]},
        {"$set": {"read": True}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"success": True, "message": "Marked as read"}


@router.put("/read-all")
def mark_all_read(current_user=Depends(get_current_user)):
    notifications_collection.update_many(
        {"user_id": current_user["_id"], "read": False}, {"$set": {"read": True}}
    )
    return {"success": True, "message": "All notifications marked as read"}
