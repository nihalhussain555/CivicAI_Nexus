import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    # --- Database ---
    MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    DATABASE_NAME = os.getenv("DATABASE_NAME", "civicai")

    # --- Auth ---
    JWT_SECRET = os.getenv("JWT_SECRET", "change-this-secret")
    JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

    # --- Frontend / CORS ---
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

    # --- AI provider abstraction ---
    # "mock" (default, no external calls), "openai", or "gemini"
    AI_PROVIDER = os.getenv("AI_PROVIDER", "mock").lower()

    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

    # Legacy single-key fallback (kept for backward compatibility)
    LLM_API_KEY = os.getenv("LLM_API_KEY", "")
    LLM_MODEL = os.getenv("LLM_MODEL", "")

    # --- SLA / prediction tuning ---
    SLA_HOURS_LOW = int(os.getenv("SLA_HOURS_LOW", "168"))       # 7 days
    SLA_HOURS_MEDIUM = int(os.getenv("SLA_HOURS_MEDIUM", "72"))  # 3 days
    SLA_HOURS_HIGH = int(os.getenv("SLA_HOURS_HIGH", "24"))      # 1 day
    SLA_HOURS_CRITICAL = int(os.getenv("SLA_HOURS_CRITICAL", "6"))

    # --- Incident clustering ---
    INCIDENT_CLUSTER_RADIUS_KM = float(os.getenv("INCIDENT_CLUSTER_RADIUS_KM", "1.0"))
    INCIDENT_MIN_REPORTS = int(os.getenv("INCIDENT_MIN_REPORTS", "3"))

    # --- Uploads ---
    MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "8"))
    ALLOWED_IMAGE_TYPES = os.getenv(
        "ALLOWED_IMAGE_TYPES", "image/jpeg,image/png,image/webp"
    ).split(",")
    ALLOWED_AUDIO_TYPES = os.getenv(
        "ALLOWED_AUDIO_TYPES", "audio/webm,audio/mpeg,audio/wav,audio/mp4,audio/ogg"
    ).split(",")
    UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")

    # --- Rate limiting ---
    RATE_LIMIT_PER_MINUTE = int(os.getenv("RATE_LIMIT_PER_MINUTE", "60"))

    # --- Demo / first-run behavior ---
    # If true (default), the backend seeds demo departments/users/grievances
    # automatically on startup when no admin account exists yet. This makes
    # the demo accounts (citizen@demo.com / officer@demo.com / admin@demo.com,
    # password Demo@123) work out of the box regardless of how the backend
    # is launched (uvicorn, Docker Compose, etc.) without a manual seed step.
    # Set to false in real deployments.
    AUTO_SEED_DEMO_DATA = os.getenv("AUTO_SEED_DEMO_DATA", "true").lower() == "true"


settings = Settings()