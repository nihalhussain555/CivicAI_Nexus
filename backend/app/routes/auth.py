from fastapi import APIRouter, HTTPException, Depends

from app.schemas.auth import RegisterRequest, LoginRequest
from app.services.auth_service import register_user, authenticate
from app.utils.security import create_access_token
from app.utils.dependencies import get_current_user
from app.utils.helpers import serialize_document


router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/register")
def register(data: RegisterRequest):
    try:
        user_id = register_user(data.name, data.email, data.password, data.language, data.phone)
        return {"success": True, "message": "Registration successful", "data": {"user_id": user_id}}
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))


@router.post("/login")
def login(data: LoginRequest):
    user = authenticate(data.email, data.password)

    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(str(user["_id"]), user["role"])

    return {
        "success": True,
        "data": {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": str(user["_id"]),
                "name": user["name"],
                "email": user["email"],
                "role": user["role"],
                "department": user.get("department"),
                "language": user.get("language", "English"),
            },
        },
    }


@router.get("/me")
def me(current_user=Depends(get_current_user)):
    user = dict(current_user)
    user.pop("password_hash", None)
    return {"success": True, "data": serialize_document(user)}