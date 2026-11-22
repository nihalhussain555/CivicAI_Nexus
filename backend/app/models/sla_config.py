"""Persistent, admin-editable SLA policy.

One document (``_id == "global"``) holds the live configuration; absence of
the document means "fall back to environment defaults" (see
``services/sla_service.get_config``), so the system behaves exactly as before
until an administrator saves a policy.

Statuses here describe the SLA clock for a case; they are deliberately a
different vocabulary from the grievance lifecycle status (``models/grievance``),
which describes the case workflow.
"""

from datetime import datetime


SLA_CONFIG_ID = "global"

# SLA clock states stored on grievance.sla_status.
SLA_STATUSES = (
    "ON_TRACK",
    "WARNING",
    "URGENT",
    "BREACHED",
    "ESCALATED",
    "RESOLVED",
)

# Escalation thresholds as fractions of the SLA window.
DEFAULT_THRESHOLDS = {
    "warning": 0.75,
    "urgent": 0.90,
    "breach": 1.00,
    "senior": 1.25,
}

# Working-hour policy, evaluated in UTC (every timestamp in this app is naive
# UTC — introducing a wall-clock zone here would fork the time vocabulary).
DEFAULT_WORKING_HOURS = {
    "enabled": False,
    "start_hour": 9,
    "end_hour": 18,
    "work_days": [0, 1, 2, 3, 4, 5],  # Monday=0 ... Saturday=5
}

DEFAULT_PRIORITY_CHANGE_POLICY = "RECALCULATE"  # RECALCULATE | KEEP
DEFAULT_REOPEN_POLICY = "NEW_SLA"               # NEW_SLA | REMAINING

DEFAULT_DEPARTMENT_OVERRIDES = {}


def sla_config_document(
    priority_hours: dict,
    thresholds: dict,
    working_hours: dict,
    email_notifications: bool,
    scheduler_interval_minutes: int,
    priority_change_policy: str,
    reopen_policy: str,
    department_overrides: dict,
    updated_by=None,
):
    return {
        "_id": SLA_CONFIG_ID,
        "priority_hours": priority_hours,
        "thresholds": thresholds,
        "working_hours": working_hours,
        "email_notifications": email_notifications,
        "scheduler_interval_minutes": scheduler_interval_minutes,
        "priority_change_policy": priority_change_policy,
        "reopen_policy": reopen_policy,
        "department_overrides": department_overrides,
        "updated_by": updated_by,
        "updated_at": datetime.utcnow(),
        "created_at": datetime.utcnow(),
    }
