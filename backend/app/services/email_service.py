"""
Email services for CivicAI Nexus.

Supports:
- OTP verification emails
- Password reset emails
- Mock mode for development
- SMTP mode for real email delivery
"""

import hashlib
import secrets
import smtplib
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.utils import parseaddr

from app.config.settings import settings


# ============================================================
# OTP
# ============================================================

def generate_otp() -> str:
    """Generate a cryptographically secure numeric OTP."""
    digits = "0123456789"

    return "".join(
        secrets.choice(digits)
        for _ in range(settings.OTP_LENGTH)
    )


def hash_otp(otp: str) -> str:
    """Hash OTP using the application secret."""

    salted = f"{otp}:{settings.JWT_SECRET}"

    return hashlib.sha256(
        salted.encode("utf-8")
    ).hexdigest()


def make_otp_expiry() -> datetime:
    """Return OTP expiration time."""

    return datetime.utcnow() + timedelta(
        minutes=settings.OTP_EXPIRE_MINUTES
    )


# ============================================================
# Email configuration
# ============================================================

def email_config_status() -> dict:
    """Return email configuration status."""

    if settings.EMAIL_PROVIDER == "smtp":

        configured = bool(
            settings.SMTP_HOST
            and settings.SMTP_USER
            and settings.SMTP_PASSWORD
        )

        return {
            "provider": "smtp",
            "configured": configured,
            "host": settings.SMTP_HOST or None,
            "missing_fields": []
            if configured
            else [
                field
                for field in (
                    "SMTP_HOST",
                    "SMTP_USER",
                    "SMTP_PASSWORD",
                )
                if not getattr(settings, field)
            ],
        }

    return {
        "provider": "mock",
        "configured": True,
        "note": "No real email is sent in mock mode.",
    }


# ============================================================
# OTP Email
# ============================================================

def send_otp_email(
    to_email: str,
    name: str,
    otp: str
) -> dict:

    subject = "Your CivicAI Nexus verification code"

    body = (
        f"Hi {name},\n\n"
        f"Your CivicAI Nexus verification code is: {otp}\n"
        f"This code expires in "
        f"{settings.OTP_EXPIRE_MINUTES} minutes.\n\n"
        "If you didn't request this, you can safely ignore "
        "this email.\n\n"
        "Regards,\n"
        "CivicAI Nexus Team"
    )

    # Mock mode
    if settings.EMAIL_PROVIDER != "smtp":

        print(
            "\n--- MOCK EMAIL ---\n"
            f"To: {to_email}\n"
            f"Subject: {subject}\n"
            f"{body}\n"
            "------------------\n"
        )

        return {
            "sent": False,
            "provider": "mock",
            "dev_otp": otp,
        }

    # SMTP configuration check
    if not (
        settings.SMTP_HOST
        and settings.SMTP_USER
        and settings.SMTP_PASSWORD
    ):

        print(
            "ERROR: SMTP configuration is incomplete."
        )

        return {
            "sent": False,
            "provider": "smtp",
            "error": "SMTP configuration is incomplete",
        }

    try:

        _send_via_smtp(
            to_email,
            subject,
            body
        )

        print(
            f"SUCCESS: Email sent via SMTP to {to_email}"
        )

        return {
            "sent": True,
            "provider": "smtp",
        }

    except smtplib.SMTPAuthenticationError as error:

        print(
            f"ERROR: Gmail SMTP authentication failed: "
            f"{error}"
        )

        return {
            "sent": False,
            "provider": "smtp",
            "error": "Gmail SMTP authentication failed",
        }

    except Exception as error:

        print(
            "ERROR: SMTP send failed: "
            f"{type(error).__name__}: {error}"
        )

        return {
            "sent": False,
            "provider": "smtp",
            "error": str(error),
        }


# ============================================================
# Password Reset Email
# ============================================================

def send_password_reset_email(
    to_email: str,
    name: str,
    reset_link: str
) -> dict:

    subject = "Reset your CivicAI Nexus password"

    body = (
        f"Hi {name},\n\n"
        "We received a request to reset your "
        "CivicAI Nexus password.\n\n"
        "Use the link below to create a new password:\n\n"
        f"{reset_link}\n\n"
        "This password reset link expires in "
        f"{settings.PASSWORD_RESET_EXPIRE_MINUTES} minutes.\n\n"
        "If you did not request a password reset, "
        "you can safely ignore this email.\n\n"
        "Regards,\n"
        "CivicAI Nexus Team"
    )

    # Mock mode
    if settings.EMAIL_PROVIDER != "smtp":

        print(
            "\n--- MOCK PASSWORD RESET EMAIL ---\n"
            f"To: {to_email}\n"
            f"Subject: {subject}\n"
            f"{body}\n"
            "----------------------------------\n"
        )

        return {
            "sent": False,
            "provider": "mock",
        }

    # SMTP configuration check
    if not (
        settings.SMTP_HOST
        and settings.SMTP_USER
        and settings.SMTP_PASSWORD
    ):

        print(
            "ERROR: SMTP configuration is incomplete."
        )

        return {
            "sent": False,
            "provider": "smtp",
            "error": "SMTP configuration is incomplete",
        }

    try:

        _send_via_smtp(
            to_email,
            subject,
            body
        )

        print(
            "SUCCESS: Password reset email sent "
            f"to {to_email}"
        )

        return {
            "sent": True,
            "provider": "smtp",
        }

    except smtplib.SMTPAuthenticationError as error:

        print(
            "ERROR: Gmail SMTP authentication failed: "
            f"{error}"
        )

        return {
            "sent": False,
            "provider": "smtp",
            "error": "Gmail SMTP authentication failed",
        }

    except Exception as error:

        print(
            "ERROR: Password reset email failed: "
            f"{type(error).__name__}: {error}"
        )

        return {
            "sent": False,
            "provider": "smtp",
            "error": str(error),
        }


# ============================================================
# SMTP
# ============================================================

def _send_via_smtp(
    to_email: str,
    subject: str,
    body: str
):
    message = MIMEText(body)

    message["Subject"] = subject
    message["From"] = settings.EMAIL_FROM
    message["To"] = to_email

    _, envelope_from = parseaddr(
        settings.EMAIL_FROM
    )

    envelope_from = (
        envelope_from
        or settings.SMTP_USER
    )

    with smtplib.SMTP(
        settings.SMTP_HOST,
        settings.SMTP_PORT,
        timeout=15
    ) as server:

        server.ehlo()

        if settings.EMAIL_USE_TLS:
            server.starttls()
            server.ehlo()

        server.login(
            settings.SMTP_USER,
            settings.SMTP_PASSWORD
        )

        server.sendmail(
            envelope_from,
            [to_email],
            message.as_string()
        )