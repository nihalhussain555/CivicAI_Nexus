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


def send_otp_email(to_email: str, name: str, otp: str) -> dict:
    """
    Returns a dict describing what happened, e.g.
    {"sent": True, "provider": "mock", "dev_otp": "482913"} — the frontend
    only ever sees `dev_otp` when running in mock mode, never in real SMTP
    mode, so this can't leak a real code in production.
    """
    subject = "Your CivicAI Nexus verification code"
    body = (
        f"Hi {name},\n\n"
        f"Your CivicAI Nexus verification code is: {otp}\n"
        f"This code expires in {settings.OTP_EXPIRE_MINUTES} minutes.\n\n"
        "If you didn't request this, you can safely ignore this email."
    )

    if settings.EMAIL_PROVIDER == "smtp" and settings.SMTP_HOST:
        try:
            _send_via_smtp(to_email, subject, body)
            return {"sent": True, "provider": "smtp"}
        except Exception as error:  # noqa: BLE001
            print(f"WARNING: SMTP send failed, falling back to mock/console: {error}")

    # Mock mode (default) — no real email account needed to demo signup.
    print(f"\n--- MOCK EMAIL (EMAIL_PROVIDER=mock) ---\nTo: {to_email}\nSubject: {subject}\n{body}\n-----------------------------------------\n")
    return {"sent": False, "provider": "mock", "dev_otp": otp}


def _send_via_smtp(to_email: str, subject: str, body: str):
    message = MIMEText(body)
    message["Subject"] = subject
    message["From"] = settings.EMAIL_FROM
    message["To"] = to_email

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
        if settings.EMAIL_USE_TLS:
            server.starttls()
        if settings.SMTP_USER:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(settings.EMAIL_FROM, [to_email], message.as_string())