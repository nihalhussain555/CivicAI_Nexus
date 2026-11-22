"""SLA Management API.

Authorization rules, restated at the boundary (never trusting the client):
  * dashboard / department performance / reports / scheduler health — admins
    only; district admins see only their district (scoped server-side).
  * config edits — super admins only; the config itself is validated
    server-side, so a crafted body cannot smuggle absurd deadlines.
  * per-case SLA data — the same view rule as the grievance itself
    (assert_can_view), and citizens get a stripped-down escalation history.
  * manual escalation — staff with jurisdiction over the case.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

from app.config.database import grievances_collection, sla_logs_collection
from app.services import escalation_service, sla_service
from app.services.grievance_service import (
    assert_can_view,
    build_list_query,
    get_grievance_or_404,
    paginate,
)
from app.utils.dependencies import (
    get_current_user,
    require_admin,
    require_staff,
    require_super_admin,
)
from app.utils.helpers import serialize_document

router = APIRouter(
    prefix="/api/sla",
    tags=["SLA Management"],
)


def _sla_row(grievance, config):
    """Compact per-case SLA row for list endpoints."""
    progress = sla_service.sla_progress(grievance, config)
    return {
        "grievance_id": grievance.get("grievance_id"),
        "title": grievance.get("title"),
        "status": grievance.get("status"),
        "priority": grievance.get("priority"),
        "category": grievance.get("category"),
        "department": grievance.get("department"),
        "district": grievance.get("district"),
        "assigned_officer_name": grievance.get("assigned_officer_name"),
        "created_at": grievance.get("created_at"),
        "sla_start_at": grievance.get("sla_start_at"),
        "sla_due_at": grievance.get("sla_due_at"),
        "sla_hours": grievance.get("sla_hours"),
        "sla_status": grievance.get("sla_status"),
        "sla_breached_at": grievance.get("sla_breached_at"),
        "sla_cycle": grievance.get("sla_cycle", 0),
        "percent_elapsed": progress["percent_elapsed"],
        "seconds_remaining": progress["seconds_remaining"],
        "clock_running": progress["running"],
    }


# ============================================================================
# CONFIG
# ============================================================================

@router.get("/config")
def read_config(current_user=Depends(require_staff)):
    return {"success": True, "data": sla_service.get_config()}


class SlaConfigUpdate(BaseModel):
    """PATCH-shaped: only the provided sections change. Every field is
    re-validated server-side against the full policy."""
    priority_hours: dict | None = None
    thresholds: dict | None = None
    working_hours: dict | None = None
    email_notifications: bool | None = None
    scheduler_interval_minutes: int | None = None
    priority_change_policy: str | None = None
    reopen_policy: str | None = None
    department_overrides: dict | None = None


@router.put("/config")
def update_config(
    data: SlaConfigUpdate,
    current_user=Depends(require_super_admin),
):
    partial = data.model_dump(exclude_none=True)
    if not partial:
        raise HTTPException(status_code=400, detail="No SLA settings provided")

    try:
        validated = sla_service.validate_config_update(partial)
        config = sla_service.save_config(validated, current_user)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error))

    from app.services.audit_service import log_action
    log_action(current_user["_id"], current_user["role"], "SLA_CONFIG_UPDATED",
               "sla_config", "global", {"sections": sorted(partial.keys())})

    return {"success": True, "message": "SLA configuration updated", "data": config}


# ============================================================================
# SCHEDULER HEALTH
# ============================================================================

@router.get("/scheduler-health")
def scheduler_health(current_user=Depends(require_admin)):
    from app.jobs.sla_scheduler import scheduler_health as health
    return {"success": True, "data": health()}


# ============================================================================
# DASHBOARD & ANALYTICS
# ============================================================================

@router.get("/dashboard")
def dashboard(
    date_from: str = Query(None, alias="from"),
    date_to: str = Query(None, alias="to"),
    current_user=Depends(require_admin),
):
    data = sla_service.get_dashboard(current_user, date_from=date_from, date_to=date_to)
    return {"success": True, "data": serialize_document(data)}


@router.get("/department-performance")
def department_performance(
    date_from: str = Query(None, alias="from"),
    date_to: str = Query(None, alias="to"),
    priority: str = None,
    department: str = None,
    current_user=Depends(require_admin),
):
    data = sla_service.get_department_performance(
        current_user, date_from=date_from, date_to=date_to,
        priority=priority, department=department)
    return {"success": True, "data": serialize_document(data)}


@router.get("/reports", response_class=PlainTextResponse)
def reports(
    format: str = Query("csv", pattern="^(csv|json)$"),
    date_from: str = Query(None, alias="from"),
    date_to: str = Query(None, alias="to"),
    priority: str = None,
    department: str = None,
    current_user=Depends(require_admin),
):
    """Department performance export. CSV downloads directly; json returns
    the same rows the dashboard table renders."""
    perf = sla_service.get_department_performance(
        current_user, date_from=date_from, date_to=date_to,
        priority=priority, department=department)

    if format == "json":
        return {"success": True, "data": serialize_document(perf)}

    csv_text = sla_service.performance_to_csv(perf)
    stamp = datetime.utcnow().strftime("%Y%m%d")
    return PlainTextResponse(
        csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="sla-department-report-{stamp}.csv"'},
    )


# ============================================================================
# LISTS
# ============================================================================

@router.get("/overdue")
def overdue(
    page: int = 1,
    limit: int = 20,
    department: str = None,
    priority: str = None,
    current_user=Depends(require_staff),
):
    """Active cases past their SLA deadline, worst first."""
    now = datetime.utcnow()
    query = build_list_query(current_user, status=",".join(sla_service.ACTIVE_STATUSES),
                             department=department, priority=priority)
    query["sla_due_at"] = {"$ne": None, "$lt": now}

    result = paginate(grievances_collection, query, page=page, limit=limit,
                      sort_field="sla_due_at", sort_dir=1)
    config = sla_service.get_config()
    return {
        "success": True,
        "data": {
            **{k: v for k, v in result.items() if k != "items"},
            "items": [_sla_row(g, config) for g in result["items"]],
        },
    }


@router.get("/warnings")
def warnings(
    page: int = 1,
    limit: int = 20,
    department: str = None,
    priority: str = None,
    current_user=Depends(require_staff),
):
    """Active cases at or past the warning threshold but not yet breached."""
    query = build_list_query(current_user, status=",".join(sla_service.ACTIVE_STATUSES),
                             department=department, priority=priority)
    query["sla_status"] = {"$in": [sla_service.STATUS_WARNING, sla_service.STATUS_URGENT]}

    result = paginate(grievances_collection, query, page=page, limit=limit,
                      sort_field="sla_due_at", sort_dir=1)
    config = sla_service.get_config()
    return {
        "success": True,
        "data": {
            **{k: v for k, v in result.items() if k != "items"},
            "items": [_sla_row(g, config) for g in result["items"]],
        },
    }


# ============================================================================
# PER-CASE
# ============================================================================

def _escalation_history(grievance_id: str, current_user) -> list:
    is_staff = current_user["role"] in ("officer", "admin")
    rows = list(sla_logs_collection.find(
        {"grievance_id": grievance_id},
    ).sort("created_at", -1).limit(100))

    history = []
    for row in rows:
        entry = {
            "level": row.get("level"),
            "cycle": row.get("cycle"),
            "threshold": row.get("threshold"),
            "percent_elapsed": row.get("percent_elapsed"),
            "created_at": row.get("created_at"),
            "triggered_by": row.get("triggered_by"),
        }
        if is_staff:
            entry.update({
                "message": row.get("message"),
                "department": row.get("department"),
                "priority": row.get("priority"),
                "assigned_officer": row.get("assigned_officer"),
                "recipient_ids": row.get("recipient_ids"),
                "channels": row.get("channels"),
                "sla_due_at": row.get("sla_due_at"),
                "hours_overdue": row.get("hours_overdue"),
            })
        history.append(entry)
    return serialize_document(history)


@router.get("/{grievance_id}")
def case_sla(grievance_id: str, current_user=Depends(get_current_user)):
    """Complaint-level SLA tracking. Anyone entitled to view the case can see
    its clock; the escalation history is stripped to safe fields for the
    reporter (recipients and internal channels stay staff-side)."""
    grievance = get_grievance_or_404(grievance_id)
    assert_can_view(grievance, current_user)

    data = sla_service.build_sla_view(grievance)
    data["escalation_history"] = _escalation_history(grievance_id, current_user)
    return {"success": True, "data": serialize_document(data)}


@router.get("/{grievance_id}/history")
def case_sla_history(grievance_id: str, current_user=Depends(get_current_user)):
    grievance = get_grievance_or_404(grievance_id)
    assert_can_view(grievance, current_user)
    return {"success": True, "data": _escalation_history(grievance_id, current_user)}


class ManualEscalateRequest(BaseModel):
    reason: str = Field(default="", max_length=500)


@router.post("/{grievance_id}/escalate")
def escalate(
    grievance_id: str,
    data: ManualEscalateRequest,
    current_user=Depends(require_staff),
):
    """Record a manual SLA escalation: notify the right people, keep the
    audit trail. Deliberately does NOT change case ownership or lifecycle
    status — that is what PUT /api/grievances/{id}/escalate is for."""
    grievance = get_grievance_or_404(grievance_id)
    assert_can_view(grievance, current_user)

    if not grievance.get("sla_due_at"):
        raise HTTPException(status_code=400, detail="This case has no SLA deadline yet")

    fired = escalation_service.manual_escalate(
        grievance,
        {"_id": current_user["_id"], "role": current_user["role"], "name": current_user.get("name")},
        reason=data.reason.strip() or None,
    )
    return {
        "success": True,
        "message": "Escalation recorded and notifications sent." if fired
                   else "This case was already manually escalated moments ago.",
        "data": serialize_document(sla_service.build_sla_view(grievance)),
    }
