"""SLA policy resolution, deadline arithmetic and reporting metrics.

This module is deliberately free of side effects on grievance documents —
writing SLA state to a case lives in ``escalation_service`` (which owns
escalation events) and the scheduler. Everything here is either pure
computation (deadlines, ratios, statuses) or read-only aggregation
(dashboard, department performance, CSV).

Time vocabulary: naive UTC everywhere, matching the rest of the app
(``datetime.utcnow()``).
"""

from datetime import datetime, timedelta

from app.config.database import sla_config_collection
from app.config.settings import settings
from app.models.sla_config import (
    DEFAULT_PRIORITY_CHANGE_POLICY,
    DEFAULT_REOPEN_POLICY,
    DEFAULT_THRESHOLDS,
    DEFAULT_WORKING_HOURS,
    SLA_CONFIG_ID,
    sla_config_document,
)

# Lifecycle statuses where the SLA clock is no longer running. Kept identical
# to tracking_service.SLA_STOPPED_STATUSES — one case, one definition of
# "the promise is settled", imported rather than copied so they cannot drift.
from app.services.tracking_service import SLA_STOPPED_STATUSES

ACTIVE_STATUSES = (
    "SUBMITTED",
    "AI_ANALYZED",
    "DEPARTMENT_ASSIGNED",
    "OFFICER_ACCEPTED",
    "IN_PROGRESS",
    "ESCALATED",
    "REOPENED",
)

VALID_PRIORITIES = ("LOW", "MEDIUM", "HIGH", "CRITICAL")
VALID_PRIORITY_POLICIES = (DEFAULT_PRIORITY_CHANGE_POLICY, "KEEP")
VALID_REOPEN_POLICIES = (DEFAULT_REOPEN_POLICY, "REMAINING")

STATUS_ON_TRACK = "ON_TRACK"
STATUS_WARNING = "WARNING"
STATUS_URGENT = "URGENT"
STATUS_BREACHED = "BREACHED"
STATUS_ESCALATED = "ESCALATED"
STATUS_RESOLVED = "RESOLVED"


def _naive_utc(value):
    if not isinstance(value, datetime):
        return None
    if value.tzinfo is None:
        return value
    from datetime import timezone
    return value.astimezone(timezone.utc).replace(tzinfo=None)


# ============================================================================
# CONFIG
# ============================================================================

def env_default_config() -> dict:
    """The policy the system had before any admin touched anything: SLA hour
    durations from environment settings, fixed 75/90/100/125 thresholds,
    calendar hours, scheduler interval from settings."""
    return {
        "priority_hours": {
            "LOW": settings.SLA_HOURS_LOW,
            "MEDIUM": settings.SLA_HOURS_MEDIUM,
            "HIGH": settings.SLA_HOURS_HIGH,
            "CRITICAL": settings.SLA_HOURS_CRITICAL,
        },
        "thresholds": dict(DEFAULT_THRESHOLDS),
        "working_hours": dict(DEFAULT_WORKING_HOURS),
        "email_notifications": False,
        "scheduler_interval_minutes": max(1, settings.SLA_CHECK_INTERVAL_MINUTES),
        "priority_change_policy": DEFAULT_PRIORITY_CHANGE_POLICY,
        "reopen_policy": DEFAULT_REOPEN_POLICY,
        "department_overrides": {},
        "updated_by": None,
        "updated_at": None,
    }


def _sanitize_priority_hours(raw, defaults):
    hours = dict(defaults)
    for key, value in (raw or {}).items():
        key = str(key).upper().strip()
        if key not in VALID_PRIORITIES:
            raise ValueError(f"Unknown priority '{key}' in SLA durations")
        try:
            value = int(value)
        except (TypeError, ValueError):
            raise ValueError(f"SLA duration for {key} must be a whole number of hours")
        if not 1 <= value <= 8760:
            raise ValueError(f"SLA duration for {key} must be between 1 and 8760 hours")
        hours[key] = value
    return hours


def _sanitize_thresholds(raw, defaults):
    thresholds = dict(defaults)
    for key, value in (raw or {}).items():
        if key not in defaults:
            raise ValueError(f"Unknown escalation threshold '{key}'")
        try:
            value = float(value)
        except (TypeError, ValueError):
            raise ValueError(f"Escalation threshold '{key}' must be a number (e.g. 0.75)")
        if not 0 < value <= 5:
            raise ValueError(f"Escalation threshold '{key}' must be between 0 and 5 (fractions of the SLA window)")
        thresholds[key] = value

    ordered = (
        thresholds["warning"] < thresholds["urgent"] <= thresholds["breach"] < thresholds["senior"]
    )
    if not ordered:
        raise ValueError(
            "Escalation thresholds must increase: warning < urgent <= breach < senior"
        )
    return thresholds


def _sanitize_working_hours(raw, defaults):
    wh = dict(defaults)
    wh.update({k: v for k, v in (raw or {}).items() if k in defaults})

    if not isinstance(wh["enabled"], bool):
        raise ValueError("working_hours.enabled must be true or false")

    for key in ("start_hour", "end_hour"):
        try:
            wh[key] = int(wh[key])
        except (TypeError, ValueError):
            raise ValueError(f"working_hours.{key} must be a whole hour 0-23 (UTC)")
        if not 0 <= wh[key] <= 23:
            raise ValueError(f"working_hours.{key} must be between 0 and 23 (UTC)")

    if wh["enabled"] and wh["end_hour"] <= wh["start_hour"]:
        raise ValueError("Working hours must end after they start (end_hour > start_hour)")

    days = wh["work_days"]
    if not isinstance(days, list) or not days:
        raise ValueError("working_hours.work_days must be a non-empty list of weekday numbers 0-6")
    try:
        days = sorted({int(d) for d in days})
    except (TypeError, ValueError):
        raise ValueError("working_hours.work_days entries must be weekday numbers 0-6 (Monday=0)")
    if any(d not in range(7) for d in days):
        raise ValueError("working_hours.work_days entries must be between 0 and 6 (Monday=0)")
    if wh["enabled"] and not days:
        raise ValueError("At least one working day is required when working hours are enabled")
    wh["work_days"] = days
    return wh


def _sanitize_overrides(raw, defaults):
    if raw in (None, {}):
        return {}
    if not isinstance(raw, dict):
        raise ValueError("department_overrides must be an object of department name -> durations")

    overrides = {}
    for department, hours in raw.items():
        department = str(department).strip()
        if not department:
            raise ValueError("department_overrides keys must be non-empty department names")
        if not isinstance(hours, dict):
            raise ValueError(f"Override for '{department}' must map priorities to hours")
        overrides[department] = _sanitize_priority_hours(hours, defaults)
    return overrides


def validate_config_update(partial: dict) -> dict:
    """Validate a PATCH-shaped config update against the current defaults and
    return the full, sanitized document to persist. Raises ValueError with an
    operator-readable message on anything invalid (routes turn that into 422).
    """
    base = get_config()
    allowed = {
        "priority_hours", "thresholds", "working_hours", "email_notifications",
        "scheduler_interval_minutes", "priority_change_policy", "reopen_policy",
        "department_overrides",
    }
    unknown = set(partial or {}) - allowed
    if unknown:
        raise ValueError(f"Unknown SLA setting(s): {', '.join(sorted(unknown))}")

    config = dict(base)

    if "priority_hours" in partial:
        config["priority_hours"] = _sanitize_priority_hours(
            partial["priority_hours"], base["priority_hours"])
    if "thresholds" in partial:
        config["thresholds"] = _sanitize_thresholds(
            partial["thresholds"], base["thresholds"])
    if "working_hours" in partial:
        config["working_hours"] = _sanitize_working_hours(
            partial["working_hours"], base["working_hours"])
    if "email_notifications" in partial:
        value = partial["email_notifications"]
        if not isinstance(value, bool):
            raise ValueError("email_notifications must be true or false")
        config["email_notifications"] = value
    if "scheduler_interval_minutes" in partial:
        try:
            value = int(partial["scheduler_interval_minutes"])
        except (TypeError, ValueError):
            raise ValueError("scheduler_interval_minutes must be a whole number of minutes")
        if not 1 <= value <= 1440:
            raise ValueError("scheduler_interval_minutes must be between 1 and 1440")
        config["scheduler_interval_minutes"] = value
    if "priority_change_policy" in partial:
        value = str(partial["priority_change_policy"]).upper().strip()
        if value not in VALID_PRIORITY_POLICIES:
            raise ValueError("priority_change_policy must be RECALCULATE or KEEP")
        config["priority_change_policy"] = value
    if "reopen_policy" in partial:
        value = str(partial["reopen_policy"]).upper().strip()
        if value not in VALID_REOPEN_POLICIES:
            raise ValueError("reopen_policy must be NEW_SLA or REMAINING")
        config["reopen_policy"] = value
    if "department_overrides" in partial:
        config["department_overrides"] = _sanitize_overrides(
            partial["department_overrides"], base["priority_hours"])

    # Cross-check: working hours must be able to deliver the shortest window.
    wh = config["working_hours"]
    if wh["enabled"]:
        daily_hours = max(0, wh["end_hour"] - wh["start_hour"])
        shortest = min(config["priority_hours"].values())
        if daily_hours == 0 or shortest > 8760:
            raise ValueError("Working-hour calendar cannot express the configured durations")

    return config


def get_config() -> dict:
    """The live SLA policy: the stored document merged over environment
    defaults, so a partially-written or legacy document still yields a fully
    populated config."""
    defaults = env_default_config()
    stored = sla_config_collection.find_one({"_id": SLA_CONFIG_ID}) or {}

    merged = dict(defaults)
    for key in defaults:
        if key in stored:
            merged[key] = stored[key]

    # Guard against hand-edited documents: never let a corrupt field crash the
    # scheduler — fall back to the default for that section.
    try:
        merged["priority_hours"] = _sanitize_priority_hours(
            merged["priority_hours"], defaults["priority_hours"])
        merged["thresholds"] = _sanitize_thresholds(
            merged["thresholds"], defaults["thresholds"])
        merged["working_hours"] = _sanitize_working_hours(
            merged["working_hours"], defaults["working_hours"])
    except ValueError as error:
        print(f"WARNING: stored SLA config invalid ({error}); using environment defaults")
        merged.update({k: v for k, v in defaults.items() if k in
                       ("priority_hours", "thresholds", "working_hours")})
    return merged


def save_config(validated: dict, actor: dict) -> dict:
    doc = sla_config_document(
        priority_hours=validated["priority_hours"],
        thresholds=validated["thresholds"],
        working_hours=validated["working_hours"],
        email_notifications=validated["email_notifications"],
        scheduler_interval_minutes=validated["scheduler_interval_minutes"],
        priority_change_policy=validated["priority_change_policy"],
        reopen_policy=validated["reopen_policy"],
        department_overrides=validated["department_overrides"],
        updated_by={"id": str(actor.get("_id")), "name": actor.get("name"),
                    "role": actor.get("role")} if actor else None,
    )
    created = doc.pop("created_at")
    sla_config_collection.update_one(
        {"_id": SLA_CONFIG_ID},
        {"$set": doc, "$setOnInsert": {"created_at": created}},
        upsert=True,
    )
    return get_config()


# ============================================================================
# DEADLINE ARITHMETIC
# ============================================================================

def effective_hours(config: dict, priority, department=None) -> int:
    priority = (priority or "MEDIUM").upper().strip()
    if priority not in VALID_PRIORITIES:
        priority = "MEDIUM"
    overrides = config.get("department_overrides") or {}
    table = overrides.get(department) or config["priority_hours"]
    return int(table.get(priority, table["MEDIUM"]))


def _next_working_instant(cursor: datetime, wh: dict) -> datetime:
    """Push a cursor forward to the next moment inside the working calendar."""
    while True:
        if cursor.weekday() not in wh["work_days"]:
            cursor = datetime.combine(
                (cursor + timedelta(days=1)).date(), datetime.min.time()
            ) + timedelta(hours=wh["start_hour"])
            continue
        if cursor.hour < wh["start_hour"]:
            cursor = datetime.combine(cursor.date(), datetime.min.time()) + timedelta(hours=wh["start_hour"])
            continue
        if cursor.hour >= wh["end_hour"]:
            cursor = datetime.combine(
                (cursor + timedelta(days=1)).date(), datetime.min.time()
            ) + timedelta(hours=wh["start_hour"])
            continue
        return cursor


def add_hours(start: datetime, hours: int, config: dict) -> datetime:
    """Deadline for `hours` of SLA time from `start`, honouring the working-
    hour policy. Calendar mode is plain UTC addition; working mode counts only
    hours inside the configured window (durations are small, so the per-day
    walk is trivially cheap)."""
    wh = config.get("working_hours") or DEFAULT_WORKING_HOURS
    if not wh.get("enabled"):
        return start + timedelta(hours=hours)

    remaining = timedelta(hours=hours)
    cursor = _next_working_instant(start, wh)

    while True:
        day_end = datetime.combine(cursor.date(), datetime.min.time()) + timedelta(hours=wh["end_hour"])
        available = day_end - cursor
        if remaining <= available:
            return cursor + remaining
        remaining -= available
        cursor = _next_working_instant(day_end + timedelta(seconds=1), wh)


def compute_window(start: datetime, priority, department, config: dict):
    """(sla_start, sla_due, sla_hours) for a fresh SLA cycle."""
    hours = effective_hours(config, priority, department)
    return start, add_hours(start, hours, config), hours


# ============================================================================
# RATIO / STATUS DERIVATION (pure)
# ============================================================================

def sla_progress(grievance: dict, config: dict, now: datetime = None) -> dict:
    """How far a case sits into its SLA window, and the derived clock state.

    The clock stops when the case stops being live work (see
    SLA_STOPPED_STATUSES); a closed/resolved case reports its *outcome*
    (met/missed at the moment the clock stopped) instead of a running ratio.
    """
    now = _naive_utc(now) or datetime.utcnow()
    due = _naive_utc(grievance.get("sla_due_at"))
    start = _naive_utc(grievance.get("sla_start_at")) or _naive_utc(grievance.get("created_at"))
    status = grievance.get("status")
    stopped = status in SLA_STOPPED_STATUSES

    if not due:
        return {"running": False, "ratio": None, "percent_elapsed": None,
                "seconds_remaining": None, "derived_status": STATUS_ON_TRACK,
                "outcome": None, "settled_at": None}

    reference = now
    if stopped:
        reference = (
            _naive_utc(grievance.get("resolved_at"))
            or _naive_utc(grievance.get("rejected_at"))
            or _naive_utc(grievance.get("updated_at"))
            or now
        )

    window_start = start or due
    window = max(1, int((due - window_start).total_seconds()))
    used = int((reference - window_start).total_seconds())
    ratio = used / window
    thresholds = config["thresholds"]

    if stopped:
        derived = STATUS_RESOLVED
        outcome = "missed" if reference > due else "met"
    elif ratio >= thresholds["senior"]:
        derived = STATUS_ESCALATED
        outcome = None
    elif ratio >= thresholds["breach"]:
        derived = STATUS_BREACHED
        outcome = None
    elif ratio >= thresholds["urgent"]:
        derived = STATUS_URGENT
        outcome = None
    elif ratio >= thresholds["warning"]:
        derived = STATUS_WARNING
        outcome = None
    else:
        derived = STATUS_ON_TRACK
        outcome = None

    return {
        "running": not stopped,
        "ratio": round(ratio, 4),
        "percent_elapsed": max(0, min(100, round(ratio * 100))),
        "seconds_remaining": int((due - reference).total_seconds()),
        "derived_status": derived,
        "outcome": outcome,
        "settled_at": reference if stopped else None,
    }


def build_sla_view(grievance: dict, config: dict = None, now: datetime = None) -> dict:
    """The complaint-level SLA payload served by GET /api/sla/{id} and drawn
    by the detail-page countdown. ISO-strings here are explicit-UTC (Z)
    like every other datetime leaving the API."""
    config = config or get_config()
    progress = sla_progress(grievance, config, now)

    return {
        "grievance_id": grievance.get("grievance_id"),
        "status": grievance.get("status"),
        "priority": grievance.get("priority"),
        "department": grievance.get("department"),
        "assigned_officer_name": grievance.get("assigned_officer_name"),
        "cycle": grievance.get("sla_cycle", 0),
        "sla_start_at": _naive_utc(grievance.get("sla_start_at")),
        "sla_hours": grievance.get("sla_hours"),
        "sla_due_at": _naive_utc(grievance.get("sla_due_at")),
        "sla_status": grievance.get("sla_status") or progress["derived_status"],
        "breached_at": _naive_utc(grievance.get("sla_breached_at")),
        "clock_running": progress["running"],
        "percent_elapsed": progress["percent_elapsed"],
        "ratio": progress["ratio"],
        "seconds_remaining": progress["seconds_remaining"],
        "outcome": progress["outcome"],
        "policy": {
            "priority_change": config["priority_change_policy"],
            "reopen": config["reopen_policy"],
            "working_hours": config["working_hours"]["enabled"],
        },
    }


# ============================================================================
# GRIEVANCE SLA FIELDS (mutation seam — the only place creation initializes)
# ============================================================================

def initialize_grievance_sla(grievance: dict, config: dict = None,
                             start: datetime = None) -> dict:
    """Stamp the SLA block onto a grievance document at creation time (or on
    a reopen restart). The DB-configurable policy wins over the pipeline's
    env-default deadline, so admin-edited durations apply from day one."""
    config = config or get_config()
    start = _naive_utc(start) or _naive_utc(grievance.get("created_at")) or datetime.utcnow()
    priority = (grievance.get("priority") or "MEDIUM").upper().strip()
    if priority not in VALID_PRIORITIES:
        priority = "MEDIUM"

    sla_start, due, hours = compute_window(
        start, priority, grievance.get("department"), config)

    grievance.update({
        "sla_start_at": sla_start,
        "sla_due_at": due,
        "sla_hours": hours,
        "sla_priority_basis": priority,
        "sla_status": STATUS_ON_TRACK,
        "sla_cycle": grievance.get("reopen_count", 0) or 0,
        "sla_breached_at": None,
    })
    return grievance


# ============================================================================
# REPORTING
# ============================================================================

def _scope_query(user: dict, extra: dict = None) -> dict:
    """Restrict reporting to what this admin is allowed to see: super admins
    see everything, district admins only their district."""
    query = dict(extra or {})
    if user.get("role") == "admin" and user.get("district"):
        query["district"] = user["district"]
    return query


def _parse_date(value, field):
    if value in (None, ""):
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        raise ValueError(f"{field} must be an ISO date (YYYY-MM-DD)")


def _created_range(from_date, to_date):
    rng = {}
    if from_date:
        rng["$gte"] = from_date
    if to_date:
        rng["$lte"] = to_date
    return rng


def get_dashboard(user: dict, date_from=None, date_to=None, config=None) -> dict:
    """Everything the SLA Management overview draws, from live data."""
    config = config or get_config()
    from app.config.database import grievances_collection, sla_logs_collection

    now = datetime.utcnow()
    try:
        frm = _parse_date(date_from, "from")
        to = _parse_date(date_to, "to")
    except ValueError:
        frm = to = None

    window = {}
    if frm or to:
        window["created_at"] = _created_range(frm, to)

    active_query = _scope_query(user, {**window, "status": {"$in": list(ACTIVE_STATUSES)}})
    resolved_query = _scope_query(user, {**window, "resolved_at": {"$ne": None}})

    status_counts = {s: 0 for s in
                     (STATUS_ON_TRACK, STATUS_WARNING, STATUS_URGENT, STATUS_BREACHED, STATUS_ESCALATED)}
    priority_breakdown = {p: {"active": 0, "breached": 0} for p in VALID_PRIORITIES}
    dept_totals = {}

    projection = {"status": 1, "priority": 1, "department": 1, "district": 1,
                  "created_at": 1, "resolved_at": 1, "sla_due_at": 1,
                  "sla_start_at": 1, "sla_status": 1, "title": 1, "grievance_id": 1}

    total_active = 0
    for g in grievances_collection.find(active_query, projection):
        total_active += 1
        state = (g.get("sla_status") or sla_progress(g, config)["derived_status"])
        if state in status_counts:
            status_counts[state] += 1
        pr = g.get("priority") if g.get("priority") in priority_breakdown else "MEDIUM"
        priority_breakdown[pr]["active"] += 1
        if state in (STATUS_BREACHED, STATUS_ESCALATED):
            priority_breakdown[pr]["breached"] += 1
        dept = g.get("department") or "Unassigned"
        dept_totals.setdefault(dept, {"active": 0, "breached": 0, "resolved": 0, "on_time": 0,
                                      "resolution_hours": [], "escalations": 0})
        dept_totals[dept]["active"] += 1

    # Resolved population: compliance is measured on cases that reached a
    # resolution — an in-flight case that has not hit its deadline yet is not
    # evidence about anybody's punctuality.
    resolved_total = on_time_total = 0
    resolution_seconds = []
    overdue_in_window = 0
    monthly = {}
    for g in grievances_collection.find(resolved_query, projection):
        resolved_total += 1
        due = _naive_utc(g.get("sla_due_at"))
        resolved_at = _naive_utc(g.get("resolved_at"))
        on_time = bool(due) and resolved_at <= due
        if on_time:
            on_time_total += 1
        if due and resolved_at > due:
            overdue_in_window += 1
        if due:
            start = _naive_utc(g.get("sla_start_at")) or _naive_utc(g.get("created_at"))
            if start:
                resolution_seconds.append(max(0, (resolved_at - start).total_seconds()))
        month = resolved_at.strftime("%Y-%m")
        bucket = monthly.setdefault(month, {"resolved": 0, "on_time": 0, "breached": 0})
        bucket["resolved"] += 1
        if on_time:
            bucket["on_time"] += 1
        elif due:
            bucket["breached"] += 1
        dept = g.get("department") or "Unassigned"
        dept_totals.setdefault(dept, {"active": 0, "breached": 0, "resolved": 0, "on_time": 0,
                                      "resolution_hours": [], "escalations": 0})
        dept_totals[dept]["resolved"] += 1
        if on_time:
            dept_totals[dept]["on_time"] += 1

    eligible_resolved = resolved_total
    compliance_pct = round(on_time_total / eligible_resolved * 100, 1) if eligible_resolved else None

    overdue_active = sum(
        1 for g in grievances_collection.find(
            _scope_query(user, {**window, "status": {"$in": list(ACTIVE_STATUSES)},
                                "sla_due_at": {"$ne": None, "$lt": now}}),
            {"_id": 1})
    )
    overdue_rate = round(overdue_active / total_active * 100, 1) if total_active else 0.0

    department_compliance = []
    for dept, row in dept_totals.items():
        department_compliance.append({
            "department": dept,
            "compliance_pct": round(row["on_time"] / row["resolved"] * 100, 1) if row["resolved"] else None,
            "resolved": row["resolved"],
            "active": row["active"],
        })
    department_compliance.sort(key=lambda d: (d["compliance_pct"] is None, -(d["compliance_pct"] or 0)))

    critical_unresolved = list(grievances_collection.find(
        _scope_query(user, {"status": {"$in": list(ACTIVE_STATUSES)},
                            "priority": {"$in": ["CRITICAL", "HIGH"]}}),
        projection,
    ).sort([("sla_due_at", 1)]).limit(20))

    escalation_rows = list(sla_logs_collection.find(
        _scope_query(user), {},
    ).sort("created_at", -1).limit(15))

    by_level = {}
    for log in sla_logs_collection.find({}, {"level": 1}):
        by_level[log.get("level")] = by_level.get(log.get("level"), 0) + 1

    avg_hours = round(sum(resolution_seconds) / len(resolution_seconds) / 3600, 1) if resolution_seconds else None

    return {
        "generated_at": now,
        "range": {"from": frm, "to": to},
        "overview": {
            "total_active": total_active,
            "on_time_resolutions": on_time_total,
            "resolved_total": resolved_total,
            "warning": status_counts[STATUS_WARNING],
            "urgent": status_counts[STATUS_URGENT],
            "breached": status_counts[STATUS_BREACHED] + status_counts[STATUS_ESCALATED],
            "compliance_pct": compliance_pct,
            "overdue_active": overdue_active,
            "overdue_rate_active": overdue_rate,
            "avg_resolution_hours": avg_hours,
        },
        "status_distribution": [{"name": k.replace("_", " ").title(), "count": v}
                                for k, v in status_counts.items()],
        "priority_breakdown": [{"priority": p, **counts} for p, counts in priority_breakdown.items()],
        "department_compliance": department_compliance,
        "monthly_trends": [{"month": m, **monthly[m]} for m in sorted(monthly)],
        "escalation_stats": {"total": sum(by_level.values()), "by_level": by_level},
        "critical_unresolved": [
            {
                "grievance_id": g.get("grievance_id"),
                "title": g.get("title"),
                "priority": g.get("priority"),
                "department": g.get("department"),
                "district": g.get("district"),
                "status": g.get("status"),
                "sla_due_at": _naive_utc(g.get("sla_due_at")),
                "sla_status": g.get("sla_status"),
            }
            for g in critical_unresolved
        ],
        "recent_escalations": [
            {k: v for k, v in log.items() if k != "_id"}
            for log in escalation_rows
        ],
    }


def get_department_performance(user: dict, date_from=None, date_to=None,
                               priority=None, department=None, config=None) -> dict:
    """Ranked department table + period comparison, computed from cases whose
    created_at falls inside the requested window."""
    config = config or get_config()
    from app.config.database import grievances_collection, sla_logs_collection

    now = datetime.utcnow()
    frm = _parse_date(date_from, "from")
    to = _parse_date(date_to, "to")

    base = _scope_query(user, {})
    if priority and priority.upper() in VALID_PRIORITIES:
        base["priority"] = priority.upper()
    if department:
        base["department"] = department

    def within(row_from, row_to):
        q = dict(base)
        rng = _created_range(row_from, row_to)
        if rng:
            q["created_at"] = rng
        return q

    projection = {"status": 1, "department": 1, "district": 1, "priority": 1,
                  "created_at": 1, "resolved_at": 1, "sla_due_at": 1,
                  "sla_start_at": 1, "assigned_at": 1, "history": 1}

    def collect(query):
        stats = {}
        for g in grievances_collection.find(query, projection):
            dept = g.get("department") or "Unassigned"
            row = stats.setdefault(dept, {
                "department": dept, "total": 0, "resolved": 0, "pending": 0,
                "overdue": 0, "on_time": 0, "_resolution_seconds": [],
                "_response_seconds": [],
            })
            row["total"] += 1
            status = g.get("status")
            due = _naive_utc(g.get("sla_due_at"))
            resolved_at = _naive_utc(g.get("resolved_at"))

            if status in SLA_STOPPED_STATUSES:
                if resolved_at:
                    row["resolved"] += 1
                    if due and resolved_at <= due:
                        row["on_time"] += 1
                    start = _naive_utc(g.get("sla_start_at")) or _naive_utc(g.get("created_at"))
                    if start:
                        row["_resolution_seconds"].append(max(0, (resolved_at - start).total_seconds()))
                    first_touch = _naive_utc(g.get("assigned_at")) or _first_staff_touch(g)
                    if first_touch:
                        row["_response_seconds"].append(
                            max(0, (first_touch - (start or first_touch)).total_seconds()))
            elif status in ACTIVE_STATUSES:
                row["pending"] += 1
                if due and due < now:
                    row["overdue"] += 1
        return stats

    current = collect(within(frm, to))

    # Comparison windows: the trailing 7 and 30 days before the anchor date,
    # so "vs last week / last month" always compares like with like.
    anchor_to = to or now
    weekly_prev = collect(within(anchor_to - timedelta(days=14), anchor_to - timedelta(days=7)))
    monthly_prev = collect(within(anchor_to - timedelta(days=60), anchor_to - timedelta(days=30)))

    escalations_by_dept = {}
    for log in sla_logs_collection.find(
            _scope_query(user, {"level": {"$in": ["WARNING", "URGENT", "BREACH", "SENIOR_ESCALATION"]}}),
            {"department": 1, "level": 1}):
        dept = log.get("department") or "Unassigned"
        entry = escalations_by_dept.setdefault(dept, {"total": 0, "breaches": 0})
        entry["total"] += 1
        if log.get("level") in ("BREACH", "SENIOR_ESCALATION"):
            entry["breaches"] += 1

    departments = []
    for dept, row in current.items():
        resolved = row["resolved"]
        compliance = round(row["on_time"] / resolved * 100, 1) if resolved else None
        overdue_rate = round(row["overdue"] / row["pending"] * 100, 1) if row["pending"] else 0.0
        avg_res = (round(sum(row["_resolution_seconds"]) / len(row["_resolution_seconds"]) / 3600, 1)
                   if row["_resolution_seconds"] else None)
        avg_resp = (round(sum(row["_response_seconds"]) / len(row["_response_seconds"]) / 3600, 1)
                    if row["_response_seconds"] else None)
        esc = escalations_by_dept.get(dept, {"total": 0, "breaches": 0})
        monthly = monthly_prev.get(dept, {})
        weekly = weekly_prev.get(dept, {})
        departments.append({
            "department": dept,
            "total": row["total"],
            "resolved": resolved,
            "pending": row["pending"],
            "overdue": row["overdue"],
            "compliance_pct": compliance,
            "overdue_rate_pct": overdue_rate,
            "avg_resolution_hours": avg_res,
            "avg_response_hours": avg_resp,
            "escalations": esc["total"],
            "repeated_violations": esc["breaches"],
            "prev_week": {
                "resolved": weekly.get("resolved", 0),
                "compliance_pct": (round(weekly["on_time"] / weekly["resolved"] * 100, 1)
                                   if weekly.get("resolved") else None),
            },
            "prev_month": {
                "resolved": monthly.get("resolved", 0),
                "compliance_pct": (round(monthly["on_time"] / monthly["resolved"] * 100, 1)
                                   if monthly.get("resolved") else None),
            },
        })

    departments.sort(key=lambda d: (d["compliance_pct"] is None, -(d["compliance_pct"] or 0), -d["total"]))
    for position, row in enumerate(departments, start=1):
        row["rank"] = position

    return {
        "generated_at": now,
        "range": {"from": frm, "to": to},
        "departments": departments,
    }


def _first_staff_touch(grievance: dict):
    """Earliest moment a human touched the case (accept/start), from the
    append-only history — response time only exists where response events
    were actually tracked, so this returns None rather than guessing."""
    best = None
    for entry in grievance.get("history") or []:
        if isinstance(entry, dict) and entry.get("status") in ("OFFICER_ACCEPTED", "IN_PROGRESS"):
            ts = _naive_utc(entry.get("timestamp"))
            if ts and (best is None or ts < best):
                best = ts
    return best


def performance_to_csv(perf: dict) -> str:
    import csv
    import io

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([
        "Rank", "Department", "Total Assigned", "Resolved", "Pending", "Overdue",
        "SLA Compliance %", "Overdue Rate % (active)", "Avg Resolution Hours",
        "Avg Response Hours", "Escalations", "SLA Violations",
    ])
    for row in perf["departments"]:
        writer.writerow([
            row["rank"], row["department"], row["total"], row["resolved"], row["pending"],
            row["overdue"],
            "" if row["compliance_pct"] is None else row["compliance_pct"],
            row["overdue_rate_pct"],
            "" if row["avg_resolution_hours"] is None else row["avg_resolution_hours"],
            "" if row["avg_response_hours"] is None else row["avg_response_hours"],
            row["escalations"], row["repeated_violations"],
        ])
    return buffer.getvalue()
