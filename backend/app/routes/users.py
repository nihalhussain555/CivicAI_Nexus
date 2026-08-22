from fastapi import APIRouter, Depends, HTTPException

from app.config.database import users_collection
from app.schemas.auth import UpdateProfileRequest, ChangePasswordRequest
from app.utils.dependencies import get_current_user
from app.utils.helpers import serialize_document
from app.utils.security import hash_password, verify_password
from datetime import datetime


router = APIRouter(prefix="/api/users", tags=["Users"])


@router.get("/me")
def get_profile(current_user=Depends(get_current_user)):
    user = dict(current_user)
    user.pop("password_hash", None)
    return {"success": True, "data": serialize_document(user)}


@router.put("/me")
def update_profile(data: UpdateProfileRequest, current_user=Depends(get_current_user)):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    updates["updated_at"] = datetime.utcnow()
    users_collection.update_one({"_id": current_user["_id"]}, {"$set": updates})

    user = users_collection.find_one({"_id": current_user["_id"]})
    user.pop("password_hash", None)
    return {"success": True, "message": "Profile updated", "data": serialize_document(user)}


@router.put("/me/password")
def change_password(data: ChangePasswordRequest, current_user=Depends(get_current_user)):
    if not verify_password(data.current_password, current_user["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    users_collection.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"password_hash": hash_password(data.new_password), "updated_at": datetime.utcnow()}},
    )
    return {"success": True, "message": "Password changed successfully"}
