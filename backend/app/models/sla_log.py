"""One document per SLA event ever fired for a grievance.

The unique index ``(grievance_id, cycle, level, event_key)`` (see
``config/database.create_indexes``) is the idempotency backbone: a scheduler
tick that re-processes the same case can attempt the insert, hit the duplicate
key, and know the event already fired. No separate "processed" flags to drift
out of sync with the log.

``cycle`` is the grievance's ``sla_cycle`` (0 for the first life of a case,
+1 each reopen) so a reopened case legitimately earns fresh escalations
without any index gymnastics.

``event_key`` is "" for the four automatic thresholds and one-off lifecycle
events; manually-escalated records pass a unique key so staff can escalate a
case again in the same cycle.
"""

from datetime import datetime, timezone

# Automatic escalation thresholds.
LEVEL_WARNING = "WARNING"            # 75% elapsed — warn the assigned officer
LEVEL_URGENT = "URGENT"              # 90% elapsed — reminder + supervisors
LEVEL_BREACH = "BREACH"              # 100% elapsed — deadline missed
LEVEL_SENIOR = "SENIOR_ESCALATION"   # 125% elapsed — senior authority
# Policy / lifecycle records (never re-fire automatically).
LEVEL_PRIORITY_RECALC = "PRIORITY_RECALC"
LEVEL_CYCLE_RESTART = "CYCLE_RESTART"
LEVEL_RESOLVED_MET = "RESOLVED_MET"
LEVEL_RESOLVED_MISSED = "RESOLVED_MISSED"
# Clock stopped without a resolution ever being filed (rejected / withdrawn).
LEVEL_VOID = "VOID"
# Human-triggered (multiple allowed per cycle via event_key).
LEVEL_MANUAL_ESCALATION = "MANUAL_ESCALATION"

AUTOMATIC_LEVELS = (
    LEVEL_WARNING,
    LEVEL_URGENT,
    LEVEL_BREACH,
    LEVEL_SENIOR,
)


def _iso(value):
    if not isinstance(value, datetime):
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


def sla_log_document(
    grievance_id,
    level,
    cycle=0,
    event_key="",
    department=None,
    district=None,
    priority=None,
    assigned_officer=None,
    threshold=None,
    percent_elapsed=None,
    sla_start_at=None,
    sla_due_at=None,
    hours_overdue=None,
    recipient_ids=None,
    channels=None,
    message=None,
    triggered_by="scheduler",
    created_at=None,
):
    return {
        "grievance_id": grievance_id,
        "cycle": int(cycle or 0),
        "level": level,
        "event_key": event_key or "",
        "department": department,
        "district": district,
        "priority": priority,
        # Denormalized from the case at fire time: officer-performance
        # aggregates read this log without a join, and the officer who held
        # the case when it breached stays on record even if ownership moves.
        "assigned_officer": str(assigned_officer) if assigned_officer else None,
        "threshold": threshold,
        "percent_elapsed": percent_elapsed,
        "sla_start_at": _iso(sla_start_at),
        "sla_due_at": _iso(sla_due_at),
        "hours_overdue": hours_overdue,
        "recipient_ids": [str(r) for r in (recipient_ids or [])],
        # {"in_app": n, "email": n, "push": bool, "errors": [...]}
        "channels": channels or {},
        "message": message,
        "triggered_by": triggered_by,
        "created_at": created_at or datetime.utcnow(),
    }
