import asyncio
import logging
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
import os

from app.config.database import check_database_connection, create_indexes
from app.config.settings import settings
from app.services.email_service import email_config_status
from app.utils.security import decode_token

from app.routes.auth import router as auth_router
from app.routes.users import router as users_router
from app.routes.grievances import router as grievances_router
from app.routes.integrity import router as integrity_router
from app.routes.ai import router as ai_router
from app.routes.admin import router as admin_router
from app.routes.departments import router as departments_router
from app.routes.officers import router as officers_router
from app.routes.incidents import router as incidents_router
from app.routes.notifications import router as notifications_router
from app.routes.analytics import router as analytics_router
from app.routes.uploads import router as uploads_router
from app.routes.rewards import router as rewards_router
from app.routes.push import router as push_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Starting CivicAI Nexus backend...")
    print(f"AI provider: {settings.AI_PROVIDER}")

    if settings.JWT_SECRET == "change-this-secret":
        print(
            "WARNING: JWT_SECRET is still the built-in placeholder. Anyone "
            "with the source can forge login tokens — set a strong random "
            "JWT_SECRET in .env (local) and in the Render environment "
            "before this app handles real traffic."
        )
    if not settings.VAPID_PRIVATE_KEY:
        print(
            "NOTE: VAPID_PRIVATE_KEY is not set — browser push is disabled. "
            "In-app notifications still work. Set the env var to re-enable "
            "push (see .env.example)."
        )

    # MongoDB (esp. in Docker Compose) can still be initializing when this
    # process starts — `depends_on` only waits for the container to launch,
    # not for Mongo to actually accept connections. Retry briefly instead
    # of giving up on the first failed ping.
    connected = False
    # check_database_connection uses a 5s serverSelectionTimeout; 15 retries
    # would freeze startup for ~90s when Mongo/Atlas is unreachable
    # (e.g. IP not whitelisted). 5 retries ≈ 30s worst case, then serve
    # anyway so /health can report the problem to the operator.
    for attempt in range(5):
        if check_database_connection():
            connected = True
            break
        print(f"MongoDB not ready yet, retrying ({attempt + 1}/5)...")
        await asyncio.sleep(1)

    if connected:
        print("MongoDB connection successful.")
        create_indexes()

        if settings.AUTO_SEED_DEMO_DATA:
            try:
                from app.seed.seed_data import run as seed_run
                seed_run(reset=False)  # no-ops safely if demo data already exists
            except Exception as error:  # noqa: BLE001
                print(f"WARNING: auto-seed failed (you can seed manually instead): {error}")
    else:
        print("WARNING: MongoDB is not connected. Set MONGO_URI in .env.")

    yield

    print("CivicAI Nexus backend shutting down.")


app = FastAPI(
    title="CivicAI Nexus",
    version="1.0.0",
    description="Predictive Multimodal Grievance Intelligence & Resolution Platform API",
    lifespan=lifespan,
)


def _normalize_origin(origin: str) -> str:
    # Browsers send `Origin` without a trailing slash; an allowlist entry
    # like "https://app.example.com/" never matches and silently blocks
    # every request (the classic "login freezes in production" bug).
    return origin.strip().rstrip("/")


_cors_origins = list(dict.fromkeys(
    _normalize_origin(o)
    for o in [
        settings.FRONTEND_URL,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://civicai-theta.vercel.app",
    ]
    if o and o.strip()
))

# NOTE: CORSMiddleware is registered AFTER the middleware decorators below,
# because Starlette makes the last-added middleware outermost. CORS must sit
# outermost so that even short-circuited 403/429 responses carry
# Access-Control-Allow-Origin — without it the browser reports those as
# opaque "CORS errors" and the frontend freezes with no useful message.

# --- Rate limiting: in-memory fixed-window counter per client IP.
# Not a distributed limiter (fine for one Render instance); the point is
# to make RATE_LIMIT_PER_MINUTE actually enforced instead of decorative. ---
_rate_buckets: dict[str, deque] = defaultdict(deque)


@app.middleware("http")
async def rate_limit_guard(request: Request, call_next):
    # RATE_LIMIT_PER_MINUTE <= 0 disables the limiter (the pytest conftest
    # sets it: every TestClient request shares one client "IP", so a full
    # suite run would otherwise exhaust a real production budget).
    if request.url.path.startswith("/api") and settings.RATE_LIMIT_PER_MINUTE > 0:
        client_ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip() \
            or (request.client.host if request.client else "unknown")
        now = time.monotonic()
        bucket = _rate_buckets[client_ip]
        while bucket and now - bucket[0] > 60:
            bucket.popleft()
        if len(bucket) >= settings.RATE_LIMIT_PER_MINUTE:
            return JSONResponse(
                status_code=429,
                content={
                    "success": False,
                    "error": {
                        "code": 429,
                        "message": "Too many requests. Please slow down and try again shortly.",
                    },
                },
            )
        bucket.append(now)
    return await call_next(request)


# --- Demo mode: specific pre-seeded demo accounts (citizen@demo.com,
# officer@demo.com, admin@demo.com by default) can log in and browse
# everything, but every mutating request they make is blocked. Real
# accounts are completely unaffected — this is per-login-token, not a
# site-wide switch. settings.DEMO_MODE remains available as an optional
# global override if you ever want to lock the entire site instead. ---
DEMO_MODE_ALLOWED_REQUESTS = {
    ("POST", "/api/auth/login"),
    ("POST", "/api/push/subscribe"),
    ("POST", "/api/push/unsubscribe"),
}

DEMO_MODE_MESSAGE = (
    "This is a demo account — actions are turned off. "
    "Feel free to explore every page; nothing you click changes real data."
)


def _request_is_from_demo_account(request) -> bool:
    auth_header = request.headers.get("authorization", "")
    if not auth_header.lower().startswith("bearer "):
        return False

    token = auth_header[7:]
    payload = decode_token(token)

    return bool(payload and payload.get("demo"))


@app.middleware("http")
async def demo_mode_guard(request, call_next):
    if (
        request.method in ("POST", "PUT", "PATCH", "DELETE")
        and (request.method, request.url.path) not in DEMO_MODE_ALLOWED_REQUESTS
        and (settings.DEMO_MODE or _request_is_from_demo_account(request))
    ):
        # Returned directly (not raised as HTTPException) so the response
        # shape is guaranteed regardless of middleware/exception-handler
        # ordering, and matches the shape the frontend already expects
        # from http_exception_handler below.
        return JSONResponse(
            status_code=403,
            content={
                "success": False,
                "error": {"code": 403, "message": DEMO_MODE_MESSAGE},
                "demo_mode": True,
            },
        )

    return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request, exc):
    # Without this, any unexpected exception (e.g. Mongo server-selection
    # timeout) returns Starlette's plain-text "Internal Server Error",
    # which the frontend's response.json() chokes on — presenting as a
    # frozen page instead of a retryable error.
    logging.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {
                "code": 500,
                "message": "Internal server error. The backend may be unreachable or misconfigured — please try again.",
            },
        },
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "error": {"code": exc.status_code, "message": exc.detail}},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    # Pydantic v2 puts raw ValueError objects under error["ctx"], which are
    # not JSON-serializable — passing exc.errors() straight into a
    # JSONResponse used to crash this handler (500 on any validation
    # failure). Sanitize to plain, human-readable strings first.
    details = []
    for e in exc.errors():
        loc = [str(p) for p in e.get("loc", []) if p not in ("body",)]
        msg = e.get("msg", "Invalid value")
        # "Value error, <our message>" — unwrap to the useful part.
        if msg.startswith("Value error, "):
            msg = msg[len("Value error, "):]
        details.append({"field": ".".join(loc) or "request", "message": msg})

    first = details[0]["message"] if details else "Validation failed"
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "error": {"code": 422, "message": first, "details": details},
        },
    )


app.include_router(auth_router)
app.include_router(users_router)
app.include_router(grievances_router)
app.include_router(integrity_router)
app.include_router(ai_router)
app.include_router(admin_router)
app.include_router(departments_router)
app.include_router(officers_router)
app.include_router(incidents_router)
app.include_router(notifications_router)
app.include_router(analytics_router)
app.include_router(uploads_router)
app.include_router(rewards_router)
app.include_router(push_router)

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")


@app.get("/")
def root():
    return {"success": True, "message": "CivicAI Nexus API is running", "version": "1.0.0"}


@app.get("/health")
def health():
    database_status = "connected" if check_database_connection() else "disconnected"
    return {
        "success": True,
        "data": {
            "status": "healthy",
            "database": database_status,
            "ai_provider": settings.AI_PROVIDER,
            # Lets you confirm from the browser (no server-log digging)
            # whether real email sending is actually configured.
            "email": email_config_status(),
            "demo_mode": settings.DEMO_MODE,
        },
    }