from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config.database import users_collection
from app.services import diagnostics_service
from app.utils.dependencies import require_admin
from app.utils.error_catalog import CATEGORY_LABELS, build_diagnosis, redact
from app.utils.helpers import serialize_documents
from app.utils.security import decode_token

from app.schemas.diagnostics import (
    ClientErrorRequest,
    EventStatusRequest,
    IssueReportRequest,
)


router = APIRouter(prefix="/api/diagnostics", tags=["Diagnostics"])

# Ingest endpoints must accept an unauthenticated caller: a failed login and a
# dead backend are exactly the moments the app needs to report an error, and in
# both cases there is no token to send. Identity is therefore read best-effort.
_optional_bearer = HTTPBearer(auto_error=False)


def optional_user(credentials=Depends(_optional_bearer)):
    if credentials is None:
        return None
    payload = decode_token(credentials.credentials)
    if not payload or not payload.get("sub"):
        return None
    try:
        from bson import ObjectId
        return users_collection.find_one({"_id": ObjectId(payload["sub"])})
    except Exception:  # noqa: BLE001
        # A malformed subject or a dead database must not turn error reporting
        # into a 500 of its own.
        return None


def _client_occurred_at(raw):
    """Clamp a browser-supplied timestamp into a sane window.

    Trusting it outright lets one mis-set clock reorder the whole dashboard.
    """
    if not raw:
        return None
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if parsed > now + timedelta(minutes=10) or parsed < now - timedelta(days=7):
        return None
    return parsed


@router.post("/client-error", status_code=202)
def report_client_error(data: ClientErrorRequest, request: Request,
                        user=Depends(optional_user)):
    """A failure the browser saw: blocked microphone, dropped connection,
    denied geolocation, a crashed React tree."""
    diagnosis = build_diagnosis(
        message=data.message,
        category=data.category or "client",
        feature=data.feature,
        path=data.path or request.url.path,
        method="CLIENT",
    )

    context = {
        "origin": "client",
        "client_path": data.path,
        "user_agent": redact(request.headers.get("user-agent") or "")[:200],
        "error_ref": data.error_ref,
    }
    if data.context:
        context["client"] = data.context

    event_id = diagnostics_service.record(
        diagnosis,
        source="frontend",
        message=data.message,
        user=user,
        context={k: v for k, v in context.items() if v not in (None, "")},
        occurred_at=_client_occurred_at(data.occurred_at),
    )

    return {
        "success": True,
        "data": {"recorded": bool(event_id), "error_ref": event_id},
    }


@router.post("/report", status_code=201)
def report_issue(data: IssueReportRequest, request: Request,
                 user=Depends(optional_user)):
    """The user's own words about what broke, linked to the machine-detected
    event when one exists."""
    note = redact(data.note) or "Issue reported"

    diagnosis = build_diagnosis(
        message=data.message or note,
        category=data.category or "client",
        feature=data.feature,
        path=data.path or request.url.path,
        method="REPORT",
    )

    context = {
        "origin": "user_report",
        "client_path": data.path,
        "steps": data.steps or [],
        "linked_error_ref": data.error_ref,
        "user_agent": redact(request.headers.get("user-agent") or "")[:200],
    }
    if data.context:
        context["client"] = {
            str(k)[:40]: str(v)[:200] for k, v in list(data.context.items())[:12]
        }

    event_id = diagnostics_service.record(
        diagnosis,
        source="user_report",
        message=note,
        user=user,
        context={k: v for k, v in context.items() if v not in (None, "", [])},
        reported_by_user=True,
        reporter_note=note,
    )

    return {
        "success": True,
        "data": {
            "report_id": event_id,
            "recorded": bool(event_id),
            "message": "Thanks — the team can see this report.",
        },
    }


# --- Admin views ------------------------------------------------------------

@router.get("/summary")
def get_summary(days: int = 7, admin_user=Depends(require_admin)):
    return {"success": True, "data": diagnostics_service.summary(days=max(1, min(days, 90)))}


@router.get("/groups")
def get_groups(status: str = None, category: str = None, feature: str = None,
               source: str = None, days: int = 30, limit: int = 25,
               user_reports: bool = False, admin_user=Depends(require_admin)):
    groups = diagnostics_service.list_groups(
        status=status,
        category=category,
        feature=feature,
        source=source,
        days=max(1, min(days, 90)),
        limit=limit,
        only_user_reports=user_reports or None,
    )
    return {
        "success": True,
        "data": {
            "items": serialize_documents(groups),
            "categories": _categories_with_labels(),
        },
    }


@router.get("/events")
def get_events(fingerprint: str = None, status: str = None, category: str = None,
               feature: str = None, source: str = None, days: int = 30, limit: int = 50,
               admin_user=Depends(require_admin)):
    items = diagnostics_service.list_events(
        fingerprint=fingerprint,
        status=status,
        category=category,
        feature=feature,
        source=source,
        days=max(1, min(days, 90)),
        limit=limit,
    )
    return {"success": True, "data": {"items": serialize_documents(items)}}


@router.get("/events/{event_id}")
def get_event(event_id: str, admin_user=Depends(require_admin)):
    event = diagnostics_service.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="No such error event.")
    return {"success": True, "data": serialize_documents([event])[0]}


@router.patch("/events/status")
def update_status(data: EventStatusRequest, admin_user=Depends(require_admin)):
    if data.status not in diagnostics_service.VALID_STATUSES:
        raise HTTPException(
            status_code=422,
            detail=f"Status must be one of: {', '.join(diagnostics_service.VALID_STATUSES)}",
        )

    if data.fingerprint:
        changed = diagnostics_service.set_group_status(
            data.fingerprint, data.status, admin_user
        )
    elif data.event_ids:
        changed = diagnostics_service.set_status(data.event_ids, data.status, admin_user)
    else:
        raise HTTPException(status_code=422, detail="Provide an event id or a fingerprint.")

    return {"success": True, "data": {"updated": changed, "status": data.status}}


def _categories_with_labels():
    return [
        {"value": key, "label": label}
        for key, label in CATEGORY_LABELS.items()
    ]
