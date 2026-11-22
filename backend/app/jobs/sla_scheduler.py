"""Background SLA monitoring loop.

Design constraints that shaped this file:

- Render (free/standard web service) gives one long-lived web process and no
  cron product; a task started in the FastAPI lifespan is the architecture
  that survives that platform. Vercel (the frontend) cannot schedule
  anything, which is why this lives backend-side.
- The loop must be restart-safe and duplicate-safe. It is: every action goes
  through ``escalation_service.sweep``, whose idempotency is enforced by the
  unique index on ``sla_logs``. Restarting mid-sweep just re-runs the tick.
- Accidental multi-instance overlap (a worker + web, or a rolling deploy
  with overlap) is fenced by a lease in ``sla_state``: only the lease holder
  sweeps, an expired lease (crash) is taken over on the next tick.
- pymongo is blocking, so each sweep runs in a worker thread; the event loop
  never waits on a Mongo scan.
"""

import asyncio
import os
import socket
import uuid
from datetime import datetime, timedelta

from pymongo.errors import DuplicateKeyError

from app.config.database import sla_state_collection
from app.config.settings import settings
from app.services import escalation_service, sla_service

STATE_ID = "sla_scheduler"

# Identifies this process in the lease document. Hostname alone collides
# between two deploys of the same service or between web + worker; the random
# suffix makes ownership unambiguous, and the lease TTL handles the crash
# case where no one releases it.
INSTANCE_ID = f"{socket.gethostname()}:{os.getpid()}:{uuid.uuid4().hex[:8]}"


def acquire_lease(lease_seconds: int) -> bool:
    """Take (or renew) the sweep lease. Atomic single-document test-and-set:
    we only match the state doc when nobody holds a live lease, when the
    lease has expired (crash takeover), or when the holder is us (renewal)."""
    now = datetime.utcnow()
    try:
        result = sla_state_collection.update_one(
            {"_id": STATE_ID,
             "$or": [
                 {"lock_expires_at": None},
                 {"lock_expires_at": {"$lte": now}},
                 {"lock_owner": INSTANCE_ID},
             ]},
            {"$set": {"lock_owner": INSTANCE_ID,
                      "lock_expires_at": now + timedelta(seconds=lease_seconds),
                      "last_lease_taken_at": now}},
            upsert=True,
        )
    except DuplicateKeyError:
        # The state doc exists but is held by a live lease (or another
        # instance won the upsert race a moment ago). Not ours this tick.
        return False
    if result.upserted_id is not None or result.modified_count:
        return True
    # Matched-but-unmodified (or a driver quirk): confirm ownership directly.
    doc = sla_state_collection.find_one({"_id": STATE_ID}) or {}
    expires = doc.get("lock_expires_at")
    return doc.get("lock_owner") == INSTANCE_ID and bool(expires) and expires > now


def release_lease():
    sla_state_collection.update_one(
        {"_id": STATE_ID, "lock_owner": INSTANCE_ID},
        {"$set": {"lock_expires_at": datetime.min.replace(microsecond=0),
                  "lock_owner": None}},
    )


def scheduler_health() -> dict:
    """Read model for GET /api/sla/scheduler-health."""
    doc = sla_state_collection.find_one({"_id": STATE_ID}) or {}
    lock_expires = doc.get("lock_expires_at")
    return {
        "enabled": settings.SLA_SCHEDULER_ENABLED,
        "instance": INSTANCE_ID,
        "lease_holder": doc.get("lock_owner"),
        "lease_live": bool(lock_expires and lock_expires > datetime.utcnow()),
        "last_run_at": doc.get("last_run_at"),
        "last_duration_ms": doc.get("last_duration_ms"),
        "last_summary": doc.get("last_summary"),
        "last_error": doc.get("last_error"),
        "last_error_at": doc.get("last_error_at"),
        "run_count": doc.get("run_count", 0),
        "interval_minutes": sla_service.get_config()["scheduler_interval_minutes"],
    }


def run_once() -> dict:
    """One monitored, leased, health-recorded sweep. Returns the sweep
    summary, or None when another instance holds the lease."""
    config = sla_service.get_config()
    lease_seconds = max(settings.SLA_LOCK_LEASE_SECONDS,
                        30 * config["scheduler_interval_minutes"])
    if not acquire_lease(lease_seconds):
        return None

    started = datetime.utcnow()
    try:
        summary = escalation_service.sweep(now=started)
        sla_state_collection.update_one(
            {"_id": STATE_ID},
            {"$set": {
                "last_run_at": started,
                "last_finished_at": datetime.utcnow(),
                "last_duration_ms": int((datetime.utcnow() - started).total_seconds() * 1000),
                "last_summary": summary,
                "last_error": None,
            },
             "$inc": {"run_count": 1}},
            upsert=True,
        )
        return summary
    except Exception as error:  # noqa: BLE001 — the loop must outlive any tick
        sla_state_collection.update_one(
            {"_id": STATE_ID},
            {"$set": {"last_error": f"{type(error).__name__}: {error}",
                      "last_error_at": datetime.utcnow(),
                      "last_run_at": started},
             "$inc": {"error_count": 1}},
            upsert=True,
        )
        print(f"ERROR: SLA scheduler sweep failed: {type(error).__name__}: {error}")
        return None


async def scheduler_loop(stop_event: asyncio.Event):
    """Run until the app shuts down. Interval is re-read from config every
    tick, so admins changing it take effect without a redeploy (a sleep is
    interrupted at most by one old-length interval; leases bound the worst
    case)."""
    print(f"SLA scheduler started (instance {INSTANCE_ID}).")
    while not stop_event.is_set():
        try:
            # Mongo work happens off the event loop.
            await asyncio.get_running_loop().run_in_executor(None, run_once)
        except Exception as error:  # noqa: BLE001
            print(f"ERROR: SLA scheduler tick crashed: {error}")

        interval = max(1, sla_service.get_config()["scheduler_interval_minutes"])
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=interval * 60)
        except asyncio.TimeoutError:
            continue

    try:
        await asyncio.get_running_loop().run_in_executor(None, release_lease)
    except Exception:  # noqa: BLE001
        pass
    print("SLA scheduler stopped.")
