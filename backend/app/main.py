import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
import os

from app.config.database import check_database_connection, create_indexes
from app.config.settings import settings

from app.routes.auth import router as auth_router
from app.routes.users import router as users_router
from app.routes.grievances import router as grievances_router
from app.routes.ai import router as ai_router
from app.routes.admin import router as admin_router
from app.routes.departments import router as departments_router
from app.routes.officers import router as officers_router
from app.routes.incidents import router as incidents_router
from app.routes.notifications import router as notifications_router
from app.routes.analytics import router as analytics_router
from app.routes.uploads import router as uploads_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Starting CivicAI Nexus backend...")
    print(f"AI provider: {settings.AI_PROVIDER}")

    # MongoDB (esp. in Docker Compose) can still be initializing when this
    # process starts — `depends_on` only waits for the container to launch,
    # not for Mongo to actually accept connections. Retry briefly instead
    # of giving up on the first failed ping.
    connected = False
    for attempt in range(15):
        if check_database_connection():
            connected = True
            break
        print(f"MongoDB not ready yet, retrying ({attempt + 1}/15)...")
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


app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "error": {"code": exc.status_code, "message": exc.detail}},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    return JSONResponse(
        status_code=422,
        content={"success": False, "error": {"code": 422, "message": "Validation failed",
                                              "details": exc.errors()}},
    )


app.include_router(auth_router)
app.include_router(users_router)
app.include_router(grievances_router)
app.include_router(ai_router)
app.include_router(admin_router)
app.include_router(departments_router)
app.include_router(officers_router)
app.include_router(incidents_router)
app.include_router(notifications_router)
app.include_router(analytics_router)
app.include_router(uploads_router)

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")


@app.get("/")
def root():
    return {"success": True, "message": "CivicAI Nexus API is running", "version": "1.0.0"}


@app.get("/health")
def health():
    database_status = "connected" if check_database_connection() else "disconnected"
    return {"success": True, "data": {"status": "healthy", "database": database_status,
                                       "ai_provider": settings.AI_PROVIDER}}