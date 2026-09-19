"""
Email services for CivicAI Nexus.

Supports:
- OTP verification emails
- Password reset emails
- Mock mode for development
- SMTP mode for real email delivery (raw socket — blocked on some hosts,
  Render included, which blocks outbound SMTP on every plan)
- Resend mode for real email delivery over HTTPS (works on hosts, like
  Render, that block raw outbound SMTP)
"""

import hashlib
import secrets
import smtplib
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.utils import parseaddr

import requests

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
    """Return email configuration status — check this via GET /health."""

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

    if settings.EMAIL_PROVIDER == "resend":

        configured = bool(settings.RESEND_API_KEY)

        return {
            "provider": "resend",
            "configured": configured,
            "missing_fields": [] if configured else ["RESEND_API_KEY"],
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

    return _dispatch(to_email, subject, body, dev_otp=otp)


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

    return _dispatch(to_email, subject, body)


# ============================================================
# Dispatch — routes to mock / smtp / resend based on EMAIL_PROVIDER
# ============================================================

def _dispatch(to_email: str, subject: str, body: str, dev_otp: str = None) -> dict:

    # ---------------- Mock mode (local dev) ----------------
    if settings.EMAIL_PROVIDER == "mock":

        print(
            "\n--- MOCK EMAIL ---\n"
            f"To: {to_email}\n"
            f"Subject: {subject}\n"
            f"{body}\n"
            "------------------\n"
        )

        result = {"sent": False, "provider": "mock"}
        if dev_otp:
            result["dev_otp"] = dev_otp
        return result

    # ---------------- Resend (HTTPS API — works on Render) ----------------
    if settings.EMAIL_PROVIDER == "resend":

        if not settings.RESEND_API_KEY:
            print("ERROR: RESEND_API_KEY is not configured.")
            return {
                "sent": False,
                "provider": "resend",
                "error": "RESEND_API_KEY is not configured",
            }

        try:
            _send_via_resend(to_email, subject, body)

            print(f"SUCCESS: Email sent via Resend to {to_email}")

            return {"sent": True, "provider": "resend"}

        except requests.exceptions.RequestException as error:

            print(f"ERROR: Resend request failed: {type(error).__name__}: {error}")

            return {
                "sent": False,
                "provider": "resend",
                "error": f"Resend request failed: {error}",
            }

        except Exception as error:

            print(f"ERROR: Resend send failed: {type(error).__name__}: {error}")

            return {
                "sent": False,
                "provider": "resend",
                "error": str(error),
            }

    # ---------------- Raw SMTP (blocked on Render — kept for hosts that
    # allow outbound SMTP, e.g. a VPS or local self-hosting) ----------------
    if settings.EMAIL_PROVIDER == "smtp":

        if not (
            settings.SMTP_HOST
            and settings.SMTP_USER
            and settings.SMTP_PASSWORD
        ):

            print("ERROR: SMTP configuration is incomplete.")

            return {
                "sent": False,
                "provider": "smtp",
                "error": "SMTP configuration is incomplete",
            }

        try:

            _send_via_smtp(to_email, subject, body)

            print(f"SUCCESS: Email sent via SMTP to {to_email}")

            return {"sent": True, "provider": "smtp"}

        except smtplib.SMTPAuthenticationError as error:

            print(f"ERROR: Gmail SMTP authentication failed: {error}")

            return {
                "sent": False,
                "provider": "smtp",
                "error": "Gmail SMTP authentication failed",
            }

        except OSError as error:

            # Errno 101 "Network is unreachable" and similar — the host's
            # firewall is blocking outbound SMTP. Retrying or fixing
            # credentials won't help; switch EMAIL_PROVIDER to "resend".
            print(f"ERROR: SMTP network error (host likely blocks outbound SMTP): {error}")

            return {
                "sent": False,
                "provider": "smtp",
                "error": (
                    "Network error reaching the SMTP server — this host may be "
                    "blocking outbound SMTP. Consider EMAIL_PROVIDER=resend."
                ),
            }

        except Exception as error:

            print(f"ERROR: SMTP send failed: {type(error).__name__}: {error}")

            return {
                "sent": False,
                "provider": "smtp",
                "error": str(error),
            }

    print(f"ERROR: Unknown EMAIL_PROVIDER '{settings.EMAIL_PROVIDER}'")

    return {
        "sent": False,
        "provider": settings.EMAIL_PROVIDER,
        "error": f"Unknown EMAIL_PROVIDER '{settings.EMAIL_PROVIDER}'",
    }


# ============================================================
# Resend (HTTPS API)
# ============================================================

def _send_via_resend(to_email: str, subject: str, body: str):
    response = requests.post(
        "https://api.resend.com/emails",
        headers={
            "Authorization": f"Bearer {settings.RESEND_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "from": settings.EMAIL_FROM,
            "to": [to_email],
            "subject": subject,
            "text": body,
        },
        timeout=15,
    )

    if response.status_code >= 400:
        raise RuntimeError(
            f"Resend API error {response.status_code}: {response.text}"
        )

    return response.json()


# ============================================================
# SMTP (raw socket)
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