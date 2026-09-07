from fastapi import APIRouter, HTTPException, Depends

from app.schemas.auth import RegisterRequest, LoginRequest, VerifyOtpRequest, ResendOtpRequest
from app.services.auth_service import register_user, authenticate, verify_otp, resend_otp
from app.utils.security import create_access_token
from app.utils.dependencies import get_current_user
from app.utils.helpers import serialize_document


router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/register")
def register(data: RegisterRequest):
    try:
        result = register_user(data.name, data.email, data.password, data.language, data.phone)
        return {
            "success": True,
            "message": "Registration successful — check your email for a verification code.",
            "data": result,
        }
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))


@router.post("/verify-otp")
def verify_otp_route(data: VerifyOtpRequest):
    result = verify_otp(data.email, data.otp_code)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return {
        "success": True,
        "message": "Already verified." if result["already_verified"] else "Email verified successfully.",
    }


@router.post("/resend-otp")
def resend_otp_route(data: ResendOtpRequest):
    result = resend_otp(data.email)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return {
        "success": True,
        "message": "A new verification code has been sent.",
        "data": {"email_sent": result["email_sent"], "dev_otp": result.get("dev_otp")},
    }


@router.post("/login")
def login(data: LoginRequest):
    user = authenticate(data.email, data.password)

    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.get("email_verified", True):
        raise HTTPException(
            status_code=403,
            detail="Please verify your email before logging in. Check your inbox for the verification code.",
        )

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