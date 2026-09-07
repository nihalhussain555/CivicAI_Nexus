from datetime import datetime

from app.config.database import users_collection
from app.config.settings import settings
from app.models.user import user_document
from app.services.email_service import generate_otp, hash_otp, make_otp_expiry, send_otp_email
from app.utils.security import hash_password, verify_password


def register_user(name, email, password, language="English", phone=None):
    email = email.lower().strip()

    existing = users_collection.find_one({"email": email})
    if existing:
        raise ValueError("Email is already registered")

    password_hash = hash_password(password)

    user = user_document(
        name=name, email=email, password_hash=password_hash, role="citizen", phone=phone,
    )
    user["language"] = language

    otp = generate_otp()
    user["otp_code_hash"] = hash_otp(otp)
    user["otp_expires_at"] = make_otp_expiry()

    result = users_collection.insert_one(user)

    email_result = send_otp_email(email, name, otp)

    return {
        "user_id": str(result.inserted_id),
        "email_sent": email_result["sent"],
        # Only ever populated in mock mode (no real SMTP configured) — lets
        # the signup flow be tested end-to-end without an email account.
        # In real SMTP mode this key is simply absent.
        "dev_otp": email_result.get("dev_otp"),
    }


def verify_otp(email, otp_code):
    email = email.lower().strip()
    user = users_collection.find_one({"email": email})

    if not user:
        return {"success": False, "error": "No account found with this email."}

    if user.get("email_verified"):
        return {"success": True, "already_verified": True}

    if not user.get("otp_code_hash") or not user.get("otp_expires_at"):
        return {"success": False, "error": "No verification code is pending. Please request a new one."}

    if datetime.utcnow() > user["otp_expires_at"]:
        return {"success": False, "error": "This code has expired. Please request a new one."}

    if user.get("otp_attempts", 0) >= settings.OTP_MAX_ATTEMPTS:
        return {"success": False, "error": "Too many incorrect attempts. Please request a new code."}

    if hash_otp(otp_code) != user["otp_code_hash"]:
        users_collection.update_one({"_id": user["_id"]}, {"$inc": {"otp_attempts": 1}})
        return {"success": False, "error": "Incorrect verification code."}

    users_collection.update_one(
        {"_id": user["_id"]},
        {
            "$set": {"email_verified": True, "otp_code_hash": None, "otp_expires_at": None, "otp_attempts": 0},
        },
    )
    return {"success": True, "already_verified": False}


def resend_otp(email):
    email = email.lower().strip()
    user = users_collection.find_one({"email": email})

    if not user:
        return {"success": False, "error": "No account found with this email."}

    if user.get("email_verified"):
        return {"success": False, "error": "This account is already verified."}

    otp = generate_otp()
    users_collection.update_one(
        {"_id": user["_id"]},
        {"$set": {"otp_code_hash": hash_otp(otp), "otp_expires_at": make_otp_expiry(), "otp_attempts": 0}},
    )

    email_result = send_otp_email(email, user["name"], otp)
    return {"success": True, "email_sent": email_result["sent"], "dev_otp": email_result.get("dev_otp")}


def authenticate(email, password):
    email = email.lower().strip()

    user = users_collection.find_one({"email": email})
    if not user:
        return None

    if not verify_password(password, user["password_hash"]):
        return None

    return user