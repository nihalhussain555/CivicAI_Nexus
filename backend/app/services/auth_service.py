import hashlib
import secrets
from datetime import datetime, timedelta

from app.config.database import users_collection
from app.config.settings import settings
from app.models.user import user_document

from app.services.email_service import (
    generate_otp,
    hash_otp,
    make_otp_expiry,
    send_otp_email,
    send_password_reset_email,
)

from app.utils.security import (
    hash_password,
    verify_password,
)


# ============================================================
# Registration
# ============================================================

def register_user(
    name,
    email,
    password,
    language="English",
    phone=None
):
    email = email.lower().strip()

    existing = users_collection.find_one(
        {"email": email}
    )

    if existing:
        raise ValueError(
            "Email is already registered"
        )

    password_hash = hash_password(
        password
    )

    user = user_document(
        name=name,
        email=email,
        password_hash=password_hash,
        role="citizen",
        phone=phone,
    )

    user["language"] = language

    otp = generate_otp()

    user["otp_code_hash"] = hash_otp(
        otp
    )

    user["otp_expires_at"] = make_otp_expiry()

    result = users_collection.insert_one(
        user
    )

    email_result = send_otp_email(
        email,
        name,
        otp
    )

    return {
        "user_id": str(result.inserted_id),
        "email_sent": email_result["sent"],
        "dev_otp": email_result.get("dev_otp"),
    }


# ============================================================
# Verify OTP
# ============================================================

def verify_otp(
    email,
    otp_code
):
    email = email.lower().strip()

    user = users_collection.find_one(
        {"email": email}
    )

    if not user:
        return {
            "success": False,
            "error": "No account found with this email.",
        }

    if user.get("email_verified"):
        return {
            "success": True,
            "already_verified": True,
        }

    if (
        not user.get("otp_code_hash")
        or not user.get("otp_expires_at")
    ):
        return {
            "success": False,
            "error": (
                "No verification code is pending. "
                "Please request a new one."
            ),
        }

    if datetime.utcnow() > user["otp_expires_at"]:
        return {
            "success": False,
            "error": (
                "This code has expired. "
                "Please request a new one."
            ),
        }

    if user.get(
        "otp_attempts",
        0
    ) >= settings.OTP_MAX_ATTEMPTS:

        return {
            "success": False,
            "error": (
                "Too many incorrect attempts. "
                "Please request a new code."
            ),
        }

    if hash_otp(otp_code) != user["otp_code_hash"]:

        users_collection.update_one(
            {"_id": user["_id"]},
            {
                "$inc": {
                    "otp_attempts": 1
                }
            },
        )

        return {
            "success": False,
            "error": "Incorrect verification code.",
        }

    users_collection.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "email_verified": True,
                "otp_code_hash": None,
                "otp_expires_at": None,
                "otp_attempts": 0,
            },
        },
    )

    return {
        "success": True,
        "already_verified": False,
    }


# ============================================================
# Resend OTP
# ============================================================

def resend_otp(email):
    email = email.lower().strip()

    user = users_collection.find_one(
        {"email": email}
    )

    if not user:
        return {
            "success": False,
            "error": (
                "No account found with this email."
            ),
        }

    if user.get("email_verified"):
        return {
            "success": False,
            "error": (
                "This account is already verified."
            ),
        }

    otp = generate_otp()

    users_collection.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "otp_code_hash": hash_otp(otp),
                "otp_expires_at": make_otp_expiry(),
                "otp_attempts": 0,
            }
        },
    )

    email_result = send_otp_email(
        email,
        user["name"],
        otp
    )

    return {
        "success": True,
        "email_sent": email_result["sent"],
        "dev_otp": email_result.get("dev_otp"),
    }


# ============================================================
# Login
# ============================================================

def authenticate(
    email,
    password
):
    email = email.lower().strip()

    user = users_collection.find_one(
        {"email": email}
    )

    if not user:
        return None

    if not verify_password(
        password,
        user["password_hash"]
    ):
        return None

    return user


# ============================================================
# Forgot Password
# ============================================================

def request_password_reset(email):

    email = email.lower().strip()

    user = users_collection.find_one(
        {"email": email}
    )

    # Don't reveal whether the email exists.
    generic_message = (
        "If an account exists for this email, "
        "a password reset link has been sent."
    )

    if not user:
        return {
            "success": True,
            "message": generic_message,
        }

    # Generate cryptographically secure token.
    raw_token = secrets.token_urlsafe(48)

    # Only store token hash in MongoDB.
    token_hash = hashlib.sha256(
        raw_token.encode("utf-8")
    ).hexdigest()

    expires_at = (
        datetime.utcnow()
        + timedelta(
            minutes=settings.PASSWORD_RESET_EXPIRE_MINUTES
        )
    )

    users_collection.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "password_reset_token_hash": token_hash,
                "password_reset_expires_at": expires_at,
            }
        },
    )

    reset_link = (
        f"{settings.FRONTEND_URL}"
        f"/reset-password"
        f"?token={raw_token}"
    )

    email_result = send_password_reset_email(
        email,
        user.get("name", "Citizen"),
        reset_link
    )

    return {
        "success": True,
        "message": generic_message,
        "email_sent": email_result["sent"],
    }


# ============================================================
# Reset Password
# ============================================================

def reset_password(
    token,
    new_password
):

    if not token:
        return {
            "success": False,
            "error": (
                "Invalid or expired password reset link."
            ),
        }

    # Hash token received from frontend.
    token_hash = hashlib.sha256(
        token.encode("utf-8")
    ).hexdigest()

    user = users_collection.find_one(
        {
            "password_reset_token_hash": token_hash
        }
    )

    if not user:
        return {
            "success": False,
            "error": (
                "Invalid or expired password reset link."
            ),
        }

    expires_at = user.get(
        "password_reset_expires_at"
    )

    if not expires_at:
        return {
            "success": False,
            "error": (
                "Invalid or expired password reset link."
            ),
        }

    if datetime.utcnow() > expires_at:

        users_collection.update_one(
            {"_id": user["_id"]},
            {
                "$unset": {
                    "password_reset_token_hash": "",
                    "password_reset_expires_at": "",
                }
            },
        )

        return {
            "success": False,
            "error": (
                "This password reset link has expired."
            ),
        }

    # Hash the new password using your existing
    # password hashing system.
    password_hash = hash_password(
        new_password
    )

    # Update password and immediately invalidate
    # the reset token.
    users_collection.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "password_hash": password_hash,
            },
            "$unset": {
                "password_reset_token_hash": "",
                "password_reset_expires_at": "",
            },
        },
    )

    return {
        "success": True,
    }