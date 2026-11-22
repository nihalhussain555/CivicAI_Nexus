"""SLA escalation engine: decides what fires, notifies whom, records it once.

Idempotency is structural, not flag-based: every event this module emits is
an insert into ``sla_logs`` under the unique index
``(grievance_id, cycle, level, event_key)``. A duplicate insert attempt means
"already handled" — including after a server restart, and including when two
scheduler instances race (the loser's insert simply fails). The grievance's
``sla_status`` field is a convenience mirror of the latest automatic event;
the log is the truth.

Notification recipients mirror the app's existing authority model — there is
no separate "supervisor" role, so:
  warning    -> assigned officer
  urgent     -> assigned officer + district admins ("supervisor")
  breach     -> officer + district admins + super admins
  senior     -> everyone above + super admins flagged for immediate attention
Nobody's case ownership is ever changed here; escalation only speaks, it never
reassigns.
"""

from datetime import datetime, timedelta

from pymongo.errors import DuplicateKeyError

from app.config.database import grievances_collection, sla_logs_collection, users_collection
from app.models.sla_log import (
    AUTOMATIC_LEVELS,
    LEVEL_BREACH,
    LEVEL_CYCLE_RESTART,
    LEVEL_MANUAL_ESCALATION,
    LEVEL_PRIORITY_RECALC,
    LEVEL_RESOLVED_MET,
    LEVEL_RESOLVED_MISSED,
    LEVEL_SENIOR,
    LEVEL_URGENT,
    LEVEL_VOID,
    LEVEL_WARNING,
    sla_log_document,
)
from app.services import sla_service
from app.services.audit_service import log_action
from app.services.email_service import send_notification_email
from app.services.notification_service import notify

REPEATED_VIOLATION_WINDOW_DAYS = 30

SYSTEM_ACTOR = {"_id": None, "role": "system", "name": "System"}


def _naive(value):
    return sla_service._naive_utc(value)


def _stamp(value):
    """Deadlines inside notification text — readable, not a raw repr."""
    dt = _naive(value)
    return dt.strftime("%Y-%m-%d %H:%M UTC") if dt else str(value)


# ============================================================================
# RECIPIENTS
# ============================================================================

def _admins_for(grievance, include_super: bool):
    """District admins for the case's district, optionally plus every super
    admin (district unset). Same jurisdiction logic as the integrity-review
    notifier — only people who can actually act on the case get paged."""
    query = {
        "role": "admin",
        "active": {"$ne": False},
    }
    district = grievance.get("district")
    if include_super:
        query["$or"] = [{"district": district}, {"district": None}]
    else:
        query["district"] = district
    return list(users_collection.find(query, {"_id": 1, "name": 1, "email": 1,
                                              "notification_preferences": 1}))


def _officer_for(grievance):
    officer_id = grievance.get("assigned_officer")
    if not officer_id:
        return []
    return list(users_collection.find(
        {"_id": officer_id, "active": {"$ne": False}},
        {"_id": 1, "name": 1, "email": 1, "notification_preferences": 1},
    ))


def _email_enabled(user):
    prefs = user.get("notification_preferences") or {}
    return prefs.get("email", True)


# ============================================================================
# EVENT FIRING
# ============================================================================

def _record_event(grievance, level, event_key="", threshold=None, progress=None,
                  message=None, extra_set=None, triggered_by="scheduler",
                  actor=None):
    """Insert the SLALog row first (the idempotency gate); only a genuinely
    new event proceeds to mutation + notification. Returns True when fired."""
    now = datetime.utcnow()
    config = sla_service.get_config()
    cycle = grievance.get("sla_cycle", 0)

    doc = sla_log_document(
        grievance_id=grievance.get("grievance_id"),
        level=level,
        cycle=cycle,
        event_key=event_key,
        department=grievance.get("department"),
        district=grievance.get("district"),
        priority=grievance.get("priority"),
        assigned_officer=grievance.get("assigned_officer"),
        threshold=threshold,
        percent_elapsed=None if progress is None else progress.get("percent_elapsed"),
        sla_start_at=grievance.get("sla_start_at"),
        sla_due_at=grievance.get("sla_due_at"),
        hours_overdue=(
            round(max(0, -progress["seconds_remaining"]) / 3600, 1)
            if progress and progress.get("seconds_remaining") is not None else None
        ),
        message=message,
        triggered_by=triggered_by,
        created_at=now,
    )

    try:
        sla_logs_collection.insert_one(doc)
    except DuplicateKeyError:
        return False

    if extra_set:
        fields = dict(extra_set)
        fields["updated_at"] = now
        grievances_collection.update_one(
            {"grievance_id": grievance["grievance_id"]},
            {"$set": fields},
        )

    recipients, channels = _deliver(grievance, level, message, config)

    # Record who was actually paged, on the event itself — the audit trail
    # should answer "who did we tell about this breach" without re-running
    # recipient resolution.
    sla_logs_collection.update_one(
        {"_id": doc["_id"]},
        {"$set": {"channels": channels,
                  "recipient_ids": [str(u["_id"]) for u in recipients]}},
    )

    log_action(
        (actor or SYSTEM_ACTOR)["_id"],
        (actor or SYSTEM_ACTOR)["role"],
        f"SLA_{level}",
        "grievance",
        grievance["grievance_id"],
        {"cycle": cycle, "threshold": threshold, "due_at": str(grievance.get("sla_due_at"))},
    )
    return True


def _deliver(grievance, level, message, config):
    """Fan out a fired event to the right humans. In-app + push come free via
    notify(); email only when the global policy AND the recipient's own
    preference allow it. A failing email never aborts the sweep."""
    gid = grievance.get("grievance_id")

    titles = {
        LEVEL_WARNING: "SLA warning: case approaching its deadline",
        LEVEL_URGENT: "SLA urgent: deadline almost reached",
        LEVEL_BREACH: "SLA breached: resolution deadline missed",
        LEVEL_SENIOR: "Senior escalation: SLA violation needs immediate attention",
        LEVEL_MANUAL_ESCALATION: "Case manually escalated",
    }
    title = titles.get(level, "SLA update")

    if level == LEVEL_WARNING:
        recipients = _officer_for(grievance) or _admins_for(grievance, include_super=False)
    elif level == LEVEL_URGENT:
        recipients = _officer_for(grievance) + _admins_for(grievance, include_super=False)
    elif level == LEVEL_BREACH:
        recipients = _officer_for(grievance) + _admins_for(grievance, include_super=True)
    elif level == LEVEL_SENIOR:
        recipients = _officer_for(grievance) + _admins_for(grievance, include_super=True)
    else:
        recipients = []

    # De-duplicate by user id (an officer may also be an admin).
    seen = set()
    unique = []
    for user in recipients:
        if user["_id"] not in seen:
            seen.add(user["_id"])
            unique.append(user)

    sent_email = 0
    errors = []
    for user in unique:
        try:
            notify(
                user["_id"],
                title,
                f"{gid}: {message}",
                notification_type="SLA_RISK",
                related_grievance_id=gid,
            )
        except Exception as error:  # noqa: BLE001 — notification failure recovery
            errors.append(f"in_app:{user['_id']}:{error}")

        if config.get("email_notifications") and user.get("email") and _email_enabled(user):
            result = send_notification_email(user["email"], f"[CivicAI SLA] {title}",
                                             f"Grievance {gid}\n\n{message}\n\n"
                                             f"Department: {grievance.get('department')}\n"
                                             f"Priority: {grievance.get('priority')}\n"
                                             f"Deadline: {grievance.get('sla_due_at')}")
            if result.get("sent"):
                sent_email += 1
            elif result.get("error"):
                errors.append(f"email:{user['_id']}:{result['error']}")

    channels = {
        "in_app": len(unique),
        "email": sent_email,
        "errors": errors,
    }
    return unique, channels


# ============================================================================
# PER-CASE PROCESSING
# ============================================================================

def ensure_monitored(grievance, config, now) -> dict:
    """Backfill SLA fields on cases written before this module existed (or by
    the seed). Historical cases keep a deadline anchored at their creation
    time, matching the original pipeline rule. Returns the (possibly fresh)
    grievance."""
    if grievance.get("sla_due_at") and grievance.get("sla_start_at"):
        return grievance

    start = _naive(grievance.get("created_at")) or now
    sla_start, due, hours = sla_service.compute_window(
        start, grievance.get("priority"), grievance.get("department"), config)

    fields = {
        "sla_start_at": sla_start,
        "sla_due_at": due,
        "sla_hours": hours,
        "sla_priority_basis": (grievance.get("priority") or "MEDIUM").upper(),
        "sla_status": grievance.get("sla_status") or sla_service.STATUS_ON_TRACK,
        "sla_cycle": grievance.get("sla_cycle", grievance.get("reopen_count", 0) or 0),
    }
    grievances_collection.update_one(
        {"grievance_id": grievance["grievance_id"]}, {"$set": fields})
    grievance.update(fields)
    return grievance


def apply_reopen_cycles(grievance, config, now) -> dict:
    """A reopen (staff or citizen-rejection re-route) increments reopen_count;
    the SLA clock restarts as a new cycle so escalations can fire again.
    Policy: NEW_SLA gives a full fresh window; REMAINING gives back only what
    was left when the clock stopped. Recorded once per cycle (CYCLE_RESTART)."""
    reopen_count = grievance.get("reopen_count", 0) or 0
    cycle = grievance.get("sla_cycle", 0) or 0
    if reopen_count <= cycle:
        return grievance

    start = _naive(grievance.get("reopened_at")) or now
    remaining_seconds = None
    if config["reopen_policy"] == "REMAINING":
        due = _naive(grievance.get("sla_due_at"))
        settled = (_naive(grievance.get("resolved_at"))
                   or _naive(grievance.get("updated_at")) or now)
        if due:
            remaining_seconds = max(60, int((due - settled).total_seconds()))

    if remaining_seconds is not None:
        new_due = start + timedelta(seconds=remaining_seconds)
        hours = max(1, round(remaining_seconds / 3600))
    else:
        _, new_due, hours = sla_service.compute_window(
            start, grievance.get("priority"), grievance.get("department"), config)

    fields = {
        "sla_cycle": reopen_count,
        "sla_start_at": start,
        "sla_due_at": new_due,
        "sla_hours": hours,
        "sla_priority_basis": (grievance.get("priority") or "MEDIUM").upper(),
        "sla_status": sla_service.STATUS_ON_TRACK,
        "sla_breached_at": None,
    }
    grievances_collection.update_one(
        {"grievance_id": grievance["grievance_id"]}, {"$set": fields})
    grievance.update(fields)

    _record_event(
        grievance, LEVEL_CYCLE_RESTART, event_key=str(reopen_count),
        message=(f"SLA clock restarted for cycle {reopen_count} "
                 f"({config['reopen_policy']}): new deadline {_stamp(new_due)}"),
        triggered_by="system",
    )
    return grievance


def apply_priority_policy(grievance, config, now) -> dict:
    """Auditable priority-change handling. Editing complaint details never
    touches the clock — only a real priority change does, and only under
    RECALCULATE: the window is re-measured from the ORIGINAL sla_start_at, so
    time already spent still counts against the new deadline."""
    priority = (grievance.get("priority") or "MEDIUM").upper()
    basis = grievance.get("sla_priority_basis")

    if basis in (None, priority):
        if basis is None:
            grievances_collection.update_one(
                {"grievance_id": grievance["grievance_id"]},
                {"$set": {"sla_priority_basis": priority}})
            grievance["sla_priority_basis"] = priority
        return grievance

    event_key = f"{basis}->{priority}"
    if config["priority_change_policy"] == "KEEP":
        # Policy says honor the original promise; just re-baseline so the
        # comparison stops re-firing, and note the decision on the log.
        _record_event(
            grievance, LEVEL_PRIORITY_RECALC, event_key=event_key,
            message=(f"Priority changed {basis} -> {priority}; deadline kept per "
                     f"KEEP policy ({_stamp(grievance.get('sla_due_at'))})"),
            extra_set=None, triggered_by="system",
        )
        grievances_collection.update_one(
            {"grievance_id": grievance["grievance_id"]},
            {"$set": {"sla_priority_basis": priority}})
        grievance["sla_priority_basis"] = priority
        return grievance

    start = _naive(grievance.get("sla_start_at")) or _naive(grievance.get("created_at")) or now
    _, new_due, hours = sla_service.compute_window(
        start, priority, grievance.get("department"), config)

    fired = _record_event(
        grievance, LEVEL_PRIORITY_RECALC, event_key=event_key,
        message=(f"Priority changed {basis} -> {priority}; deadline recalculated "
                 f"from the original SLA start ({_stamp(grievance.get('sla_due_at'))} -> {_stamp(new_due)})"),
        extra_set={"sla_due_at": new_due, "sla_hours": hours,
                   "sla_priority_basis": priority},
        triggered_by="system",
    )
    if fired:
        grievance.update({"sla_due_at": new_due, "sla_hours": hours,
                          "sla_priority_basis": priority})
    return grievance


def settle_closed(grievance, config, now) -> None:
    """When the clock stops for good, record the outcome once: met, missed,
    or void (rejected/withdrawn without a resolution ever being filed)."""
    if grievance.get("sla_status") == sla_service.STATUS_RESOLVED:
        return

    progress = sla_service.sla_progress(grievance, config, now)
    status = grievance.get("status")
    if status in ("REJECTED", "WITHDRAWN"):
        level = LEVEL_VOID
        message = f"Clock stopped without a resolution ({status})."
    elif progress["outcome"] == "met":
        level = LEVEL_RESOLVED_MET
        message = "Resolved within the SLA deadline."
    else:
        level = LEVEL_RESOLVED_MISSED
        message = "Resolution filed after the SLA deadline."

    _record_event(grievance, level, message=message,
                  extra_set={"sla_status": sla_service.STATUS_RESOLVED},
                  triggered_by="system")


def process_grievance(grievance, config, now) -> str:
    """Full SLA evaluation for one case. Returns a short outcome tag for the
    sweep summary."""
    status = grievance.get("status")

    if status in sla_service.SLA_STOPPED_STATUSES:
        settle_closed(grievance, config, now)
        return "settled"

    grievance = apply_reopen_cycles(grievance, config, now)
    grievance = apply_priority_policy(grievance, config, now)

    progress = sla_service.sla_progress(grievance, config, now)
    if progress["ratio"] is None:
        return "no-deadline"

    thresholds = config["thresholds"]
    fired = []

    steps = [
        (LEVEL_WARNING, thresholds["warning"], sla_service.STATUS_WARNING, None),
        (LEVEL_URGENT, thresholds["urgent"], sla_service.STATUS_URGENT, None),
        (LEVEL_BREACH, thresholds["breach"], sla_service.STATUS_BREACHED,
         {"sla_breached_at": _naive(grievance.get("sla_due_at"))}),
        (LEVEL_SENIOR, thresholds["senior"], sla_service.STATUS_ESCALATED, None),
    ]

    for level, threshold, derived_status, extra in steps:
        if progress["ratio"] < threshold:
            continue
        message = _message_for(level, grievance, progress, threshold, now)
        merged_extra = dict(extra or {})
        merged_extra["sla_status"] = derived_status
        if _record_event(grievance, level, event_key="",
                         threshold=threshold, progress=progress, message=message,
                         extra_set=merged_extra):
            fired.append(level)
            grievance["sla_status"] = derived_status

    if fired:
        return "+".join(fired)
    # No event yet: keep the mirror honest for the pure ratio band.
    stored = grievance.get("sla_status")
    if stored != progress["derived_status"]:
        grievances_collection.update_one(
            {"grievance_id": grievance["grievance_id"]},
            {"$set": {"sla_status": progress["derived_status"]}},
        )
    return "ok"


def _message_for(level, grievance, progress, threshold, now):
    gid = grievance.get("grievance_id")
    pct = progress.get("percent_elapsed")
    due = grievance.get("sla_due_at")
    if level == LEVEL_WARNING:
        return (f"{pct}% of the SLA window for {gid} has elapsed "
                f"(deadline {_stamp(due)}). Please progress the case.")
    if level == LEVEL_URGENT:
        hours_left = max(0, progress["seconds_remaining"]) / 3600
        return (f"{gid} is {pct}% through its SLA window with only "
                f"{hours_left:.1f}h left. Supervisor has been notified.")
    if level == LEVEL_BREACH:
        overdue_h = max(0, -progress["seconds_remaining"]) / 3600
        violations = recent_violation_count(grievance.get("assigned_officer"))
        return (f"{gid} has breached its SLA deadline ({_stamp(due)}) by "
                f"{overdue_h:.1f}h. Department administrator notified."
                + (f" Officer has {violations} SLA violations in the last "
                   f"{REPEATED_VIOLATION_WINDOW_DAYS} days." if violations > 1 else ""))
    if level == LEVEL_SENIOR:
        overdue_h = max(0, -progress["seconds_remaining"]) / 3600
        return (f"{gid} is {overdue_h:.1f}h past its SLA deadline (125% of the "
                "window elapsed). Escalated to senior authority for immediate "
                "attention.")
    return f"SLA event {level} for {gid} at {pct}% elapsed."


def recent_violation_count(officer_id, level=LEVEL_BREACH):
    """Repeated-violation tracking: breaches recorded against one officer's
    cases inside the look-back window."""
    if not officer_id:
        return 0
    since = datetime.utcnow() - timedelta(days=REPEATED_VIOLATION_WINDOW_DAYS)
    return sla_logs_collection.count_documents({
        "level": level,
        "assigned_officer": str(officer_id),
        "created_at": {"$gte": since},
    })


# ============================================================================
# SWEEP (called by the scheduler; also the seam tests drive directly)
# ============================================================================

PROJECTION = {
    "grievance_id": 1, "status": 1, "priority": 1, "department": 1,
    "district": 1, "assigned_officer": 1, "created_at": 1, "updated_at": 1,
    "resolved_at": 1, "reopened_at": 1, "reopen_count": 1, "sla_start_at": 1,
    "sla_due_at": 1, "sla_hours": 1, "sla_cycle": 1, "sla_status": 1,
    "sla_priority_basis": 1, "sla_breached_at": 1,
}


def sweep(now=None, limit=500) -> dict:
    """One monitoring pass over everything that could need attention:
    active cases (backfilling any that predate SLA tracking), and stopped
    cases not yet settled. Bounded by `limit` per query; the next tick picks
    up the rest — the sweep is stateless and safe to re-run."""
    now = now or datetime.utcnow()
    config = sla_service.get_config()

    summary = {"processed": 0, "fired": 0, "backfilled": 0, "settled": 0, "errors": 0}

    # 1) Active cases: everything with a running clock. A deadline index scan
    #    would miss the backfill and ratio bands, and the active population
    #    is small; ordering by deadline means breaches are handled first.
    cursor = grievances_collection.find(
        {"status": {"$in": list(sla_service.ACTIVE_STATUSES)}},
        PROJECTION,
    ).sort([("sla_due_at", 1)]).limit(limit)

    for grievance in cursor:
        try:
            if not grievance.get("sla_due_at") or not grievance.get("sla_start_at"):
                grievance = ensure_monitored(grievance, config, now)
                summary["backfilled"] += 1
            outcome = process_grievance(grievance, config, now)
            summary["processed"] += 1
            if outcome and outcome != "ok" and "+" in (outcome or ""):
                summary["fired"] += 1
        except Exception as error:  # noqa: BLE001 — one bad case can't stall the sweep
            summary["errors"] += 1
            print(f"WARNING: SLA sweep error on {grievance.get('grievance_id')}: "
                  f"{type(error).__name__}: {error}")

    # 2) Stopped cases not yet settled (clock needs its final verdict).
    unsettled = grievances_collection.find(
        {"status": {"$in": list(sla_service.SLA_STOPPED_STATUSES)},
         "sla_status": {"$ne": sla_service.STATUS_RESOLVED}},
        PROJECTION,
    ).limit(limit)

    for grievance in unsettled:
        try:
            if not grievance.get("sla_due_at") and not grievance.get("created_at"):
                continue
            if not grievance.get("sla_due_at"):
                grievance = ensure_monitored(grievance, config, now)
            process_grievance(grievance, config, now)
            summary["settled"] += 1
        except Exception as error:  # noqa: BLE001
            summary["errors"] += 1
            print(f"WARNING: SLA settle error on {grievance.get('grievance_id')}: "
                  f"{type(error).__name__}: {error}")

    return summary


# ============================================================================
# MANUAL ESCALATION (API-driven, same log, same idempotency shape)
# ============================================================================

def manual_escalate(grievance, actor, reason=None):
    """Staff-triggered escalation. Logged + notified, ownership untouched.
    A unique event_key lets a case be manually escalated more than once per
    cycle (unlike the automatic thresholds)."""
    now = datetime.utcnow()
    event_key = f"manual:{uuid4hex()}"
    progress = sla_service.sla_progress(grievance, sla_service.get_config(), now)
    message = (f"Manually escalated by {actor.get('name', actor.get('role'))}"
               + (f": {reason}" if reason else ""))
    fired = _record_event(
        grievance, LEVEL_MANUAL_ESCALATION, event_key=event_key,
        progress=progress, message=message, triggered_by=actor.get("role"),
        actor=actor,
    )
    return fired


def uuid4hex():
    import uuid
    return uuid.uuid4().hex[:12]
