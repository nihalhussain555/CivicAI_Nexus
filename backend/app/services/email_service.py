"""
Email OTP verification for citizen signup.

Follows the same "mock by default, real provider optional" pattern as the
AI provider abstraction: with EMAIL_PROVIDER=mock (the default), no real
email is sent — the OTP is returned in the API response and printed to
the server console, so the full signup flow can be tested and demoed
without any email account configured. Set EMAIL_PROVIDER=smtp with real
SMTP credentials for actual delivery.

The OTP itself is never stored in plaintext — only its hash — so a
database leak doesn't expose active codes.
"""

import hashlib
import secrets
import smtplib
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.utils import parseaddr

from app.config.settings import settings


def generate_otp() -> str:
    """Cryptographically random numeric OTP, e.g. '482913' for length 6."""
    digits = "0123456789"
    return "".join(secrets.choice(digits) for _ in range(settings.OTP_LENGTH))


def hash_otp(otp: str) -> str:
    # A short numeric code doesn't need bcrypt's slow hashing (and doing so
    # would make brute-force *harder to detect* via timing, not easier to
    # prevent, since attempts are already capped by OTP_MAX_ATTEMPTS and a
    # short expiry) — a fast, salted-by-secret hash is appropriate here.
    salted = f"{otp}:{settings.JWT_SECRET}"
    return hashlib.sha256(salted.encode("utf-8")).hexdigest()


def make_otp_expiry() -> datetime:
    return datetime.utcnow() + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)


def email_config_status() -> dict:
    """Cheap, no-network summary of the current email configuration —
    surfaced on /health so misconfiguration is visible without digging
    through server logs."""
    if settings.EMAIL_PROVIDER == "smtp":
        configured = bool(settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD)
        return {
            "provider": "smtp",
            "configured": configured,
            "host": settings.SMTP_HOST or None,
            "missing_fields": [] if configured else [
                f for f in ("SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD")
                if not getattr(settings, f)
            ],
        }
    return {"provider": "mock", "configured": True, "note": "No real email is sent in mock mode."}


def send_otp_email(to_email: str, name: str, otp: str) -> dict:
    subject = "Your CivicAI Nexus verification code"

    body = (
        f"Hi {name},\n\n"
        f"Your CivicAI Nexus verification code is: {otp}\n"
        f"This code expires in {settings.OTP_EXPIRE_MINUTES} minutes.\n\n"
        "If you didn't request this, you can safely ignore this email."
    )

    if settings.EMAIL_PROVIDER != "smtp":
        print(
            f"\n--- MOCK EMAIL ---\n"
            f"To: {to_email}\n"
            f"Subject: {subject}\n"
            f"{body}\n"
            f"------------------\n"
        )
        return {
            "sent": False,
            "provider": "mock",
            "dev_otp": otp,
        }

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

        return {
            "sent": True,
            "provider": "smtp",
        }

    except smtplib.SMTPAuthenticationError as error:
        print(f"ERROR: Gmail SMTP authentication failed: {error}")

        return {
            "sent": False,
            "provider": "smtp",
            "error": "Gmail SMTP authentication failed",
        }

    except Exception as error:
        print(f"ERROR: SMTP send failed: {type(error).__name__}: {error}")

        return {
            "sent": False,
            "provider": "smtp",
            "error": str(error),
        }

def _send_via_smtp(to_email: str, subject: str, body: str):
    message = MIMEText(body)
    message["Subject"] = subject
    message["From"] = settings.EMAIL_FROM
    message["To"] = to_email

    # The SMTP *envelope* sender (sendmail's from_addr) must be a bare
    # address — "Display Name <addr>" is only valid inside the MIME "From"
    # header above, not here. Passing the display-name form as the
    # envelope sender is rejected or silently mishandled by many servers,
    # including some Gmail configurations. parseaddr() extracts just the
    # address half of "CivicAI Nexus <you@gmail.com>" -> "you@gmail.com".
    _, envelope_from = parseaddr(settings.EMAIL_FROM)
    envelope_from = envelope_from or settings.SMTP_USER

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
        server.ehlo()
        if settings.EMAIL_USE_TLS:
            server.starttls()
            server.ehlo()
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(envelope_from, [to_email], message.as_string())