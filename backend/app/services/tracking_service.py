"""Citizen-facing grievance tracking.

One projection, built from a whitelist, is what the tracking page renders.
Nothing about a case is shown to a citizen because it happened to be a field
on the MongoDB document — it is shown because this module decided to put it in
the response. That is the difference between "we redact the bad fields" and
"we never had the bad fields in the payload to begin with", and it is what lets
the ladder, the SLA clock and the remarks feed all speak with one voice about
the same document.
"""

from datetime import datetime, timezone

from app.config.database import notifications_collection
from app.models.grievance import (
    TRACKING_STAGES,
    STAGE_INDEX_BY_STATUS,
    OVERRIDE_STATES,
    REOPEN_WINDOW_DAYS,
    MAX_REOPEN_REQUESTS,
    DELETABLE_STATUSES,
)

# How much of the SLA window has to be gone before we start calling it tight.
SLA_AT_RISK_RATIO = 0.75
SLA_DUE_SOON_RATIO = 0.9

# Statuses in which a satisfaction rating is still the citizen's to give:
# while they are verifying the fix, and afterwards if they change their mind.
FEEDBACK_OPEN_STATUSES = {"CITIZEN_VERIFICATION", "CLOSED"}

# Statuses in which the clock is no longer running: either the fix is in for
# verification (the department has met its deadline or missed it — settled) or
# the case is finished in some way.
SLA_STOPPED_STATUSES = {
    "RESOLUTION_SUBMITTED",
    "CITIZEN_VERIFICATION",
    "CLOSED",
    "REJECTED",
    "WITHDRAWN",
}


def _naive_utc(value):
    """Everything this module compares is naive UTC (Mongo stores exactly that;
    see helpers.serialize_document for why the wire format carries a marker).
    A value that did arrive zone-aware is converted, not assumed local."""
    if not isinstance(value, datetime):
        return None
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def _iso(value):
    value = _naive_utc(value)
    return value.replace(tzinfo=timezone.utc).isoformat() if value else None


def _first_at(history, statuses):
    for entry in history:
        if isinstance(entry, dict) and entry.get("status") in statuses:
            return entry
    return None


def _latest_at(history, statuses):
    found = None
    for entry in history:
        if isinstance(entry, dict) and entry.get("status") in statuses:
            found = entry
    return found


def _public_history(grievance):
    """Append-only lifecycle log, filtered to what the reporter is owed.

    Internal events stay in the document — that is the audit trail's whole
    purpose — but they never leave it as a citizen-visible step.
    """
    history = grievance.get("history")
    safe_history = history if isinstance(history, list) else []

    return [
        entry
        for entry in safe_history
        if isinstance(entry, dict) and entry.get("visibility", "public") != "internal"
    ]


def _stage_timestamps(grievance, history):
    """When each rung of the ladder was reached, from the case's own log.

    Latest occurrence per rung, not first: a case that was reopened walks the
    ladder again, and "Assigned — 3 days ago" should describe the assignment
    the citizen is currently waiting on, not the one two cycles back.
    """
    by_rung = {
        "SUBMITTED": _latest_at(history, {"SUBMITTED"}),
        "AI_PROCESSING": _latest_at(history, {"AI_ANALYZED"}),
        "ASSIGNED": _latest_at(history, {"DEPARTMENT_ASSIGNED"}),
        "IN_PROGRESS": _latest_at(history, {"IN_PROGRESS", "OFFICER_ACCEPTED"}),
        "RESOLUTION_SUBMITTED": _latest_at(history, {"RESOLUTION_SUBMITTED"}),
        "CITIZEN_FEEDBACK": _latest_at(history, {"CITIZEN_VERIFICATION"}),
        "RESOLVED": _latest_at(history, {"CLOSED"}),
    }

    verified_at = grievance.get("verified_at")
    if verified_at:
        by_rung["VERIFIED"] = {"timestamp": verified_at, "message": "Report confirmed as genuine"}
    return by_rung


def _furthest_rung(history):
    """Ladder position reached so far, for a case sitting off the happy path.

    An escalated or rejected case still tells the citizen how far it got before
    it stopped, so the ladder is drawn from the log rather than guessed from the
    current state.
    """
    furthest = 0
    for entry in history:
        index = STAGE_INDEX_BY_STATUS.get(entry.get("status"))
        if index is not None:
            furthest = max(furthest, index)
    return furthest


def _progress_index(grievance, history):
    status = grievance.get("status")

    if status in STAGE_INDEX_BY_STATUS:
        index = STAGE_INDEX_BY_STATUS[status]
        # Routed to a department but still awaiting a human's validity verdict
        # sits on "Verified", not "Assigned" — the routing was only a
        # recommendation until somebody confirms the report is real.
        if status == "DEPARTMENT_ASSIGNED" and not grievance.get("verified_at"):
            return 2, status
        return index, status

    # A reopened case is back in the queue, not still at the rung it had
    # reached when it was closed — that would read as "already fixed".
    if status == "REOPENED":
        return 3, status

    return _furthest_rung(history), status


def build_stages(grievance, history):
    index, status = _progress_index(grievance, history)
    override = OVERRIDE_STATES.get(status)
    timestamps = _stage_timestamps(grievance, history)
    stopped = status in {"REJECTED", "WITHDRAWN"}

    stages = []
    for position, stage in enumerate(TRACKING_STAGES):
        if position < index:
            state = "done"
        elif position == index:
            # An exception state lands on the rung the case had reached and
            # colours it, instead of pretending the case is still progressing.
            # A closed case has *finished* the ladder, so its last rung is the
            # one rung "current" would be wrong on.
            if override:
                state = "blocked"
            elif stopped or index == len(TRACKING_STAGES) - 1:
                state = "done"
            else:
                state = "current"
        else:
            state = "blocked" if stopped else "pending"

        # Only a rung the case actually stood on gets a date. Showing
        # "In Progress — Tuesday" on a stage the case has not reached yet is
        # how a tracking page teaches people to distrust tracking pages.
        reached = position <= index
        rung_entry = timestamps.get(stage["key"]) if reached else None

        stages.append({
            "key": stage["key"],
            "label": stage["label"],
            "description": stage["description"],
            "state": state,
            "at": _iso(rung_entry.get("timestamp")) if rung_entry else None,
            "message": rung_entry.get("message") if rung_entry else None,
        })

    return stages, index, override


def build_sla(grievance, now=None):
    """Deadline, countdown and how much of the window the department has used.

    The clock stops the moment the department files a resolution or the case
    ends: from then on the citizen is looking at whether the promise was kept,
    not at a countdown that keeps running after the work is done.
    """
    now = _naive_utc(now) or datetime.utcnow()
    due_at = _naive_utc(grievance.get("sla_due_at"))
    status = grievance.get("status")

    if not due_at:
        return {
            "due_at": None,
            "state": "unknown",
            "label": "No deadline set yet",
            "seconds_remaining": None,
            "percent_elapsed": None,
            "clock_running": False,
            "breached": False,
        }

    started_at = _naive_utc(grievance.get("created_at")) or due_at

    stopped = status in SLA_STOPPED_STATUSES
    # While the clock is stopped, the honest "now" is the moment it stopped.
    reference = now
    if stopped:
        reference = (
            _naive_utc(grievance.get("resolved_at"))
            or _naive_utc(grievance.get("updated_at"))
            or now
        )

    remaining = int((due_at - reference).total_seconds())
    window = max(1, int((due_at - started_at).total_seconds()))
    used = window - remaining
    percent_elapsed = min(100, max(0, round(used / window * 100)))
    breached = remaining <= 0

    if not breached and stopped:
        state = "met"
        label = "Deadline met"
    elif breached and stopped:
        state = "missed"
        label = "Deadline missed — escalation review under way"
    elif breached:
        state = "breached"
        label = "Past the expected resolution date"
    elif percent_elapsed >= SLA_DUE_SOON_RATIO * 100:
        state = "due_soon"
        label = "Due shortly"
    elif percent_elapsed >= SLA_AT_RISK_RATIO * 100:
        state = "at_risk"
        label = "Running behind"
    else:
        state = "on_track"
        label = "On track"

    return {
        "due_at": _iso(due_at),
        "state": state,
        "label": label,
        # The page ticks this down live; when the clock is stopped the value is
        # frozen at the moment the work was filed, which is what "how late /
        # how early we were" means.
        "seconds_remaining": remaining,
        "percent_elapsed": percent_elapsed,
        "clock_running": not stopped,
        "breached": breached,
    }


def build_officer(grievance):
    """Who is handling the case, without saying who they are.

    Citizens get the department and district that own the file and the date it
    was picked up. The officer's name, account id and contact details stay on
    the staff side of the API — a reporter is entitled to know their case is
    with the right desk, not to know which individual is working it.
    """
    if not grievance.get("assigned_officer"):
        return {"assigned": False, "designation": None, "since": None}

    department = grievance.get("department") or "the responsible"
    district = grievance.get("district")

    designation = f"{department} field officer"
    if district:
        designation = f"{designation}, {district} district"

    return {
        "assigned": True,
        "designation": designation,
        "since": _iso(grievance.get("assigned_at")),
    }


def build_remarks(grievance):
    """Public-safe updates staff chose to send the reporter.

    INTERNAL shift notes are dropped here (they remain on the document for
    audit), and the author is reduced to a departmental designation — same rule
    as the officer block above.
    """
    remarks = grievance.get("remarks")
    safe_remarks = remarks if isinstance(remarks, list) else []

    public = []
    for remark in safe_remarks:
        if not isinstance(remark, dict) or remark.get("audience") != "PUBLIC":
            continue

        department = remark.get("department") or grievance.get("department")
        role = (remark.get("author_role") or "officer").capitalize()
        public.append({
            "remark_id": remark.get("remark_id"),
            "text": remark.get("text"),
            "created_at": _iso(remark.get("created_at")),
            "designation": f"{department} {role}" if department else f"{role}",
        })

    public.sort(key=lambda item: item.get("created_at") or "", reverse=True)
    return public


def build_evidence(grievance):
    evidence = grievance.get("resolution_evidence")
    if not isinstance(evidence, list):
        return []

    # Stored as upload paths (see routes/uploads.py); the tracking page renders
    # them through the same `/uploads/...` base the rest of the app already uses.
    return [item for item in evidence if isinstance(item, str) and item]


def build_reopen(grievance):
    status = grievance.get("status")
    resolved_at = grievance.get("resolved_at") or grievance.get("updated_at")
    within_window = True
    if isinstance(resolved_at, datetime):
        within_window = (datetime.utcnow() - resolved_at).days <= REOPEN_WINDOW_DAYS

    request_status = grievance.get("reopen_request_status")
    times_used = grievance.get("reopen_count", 0)

    return {
        "count": times_used,
        "max": MAX_REOPEN_REQUESTS,
        "window_days": REOPEN_WINDOW_DAYS,
        "request_status": request_status,
        "reason": grievance.get("reopen_reason"),
        "requested_at": _iso(grievance.get("reopen_requested_at")),
        "review_note": grievance.get("reopen_review_note"),
        "reviewed_at": _iso(grievance.get("reopen_reviewed_at")),
        "can_request": (
            status == "CLOSED"
            and request_status != "PENDING"
            and times_used < MAX_REOPEN_REQUESTS
            and within_window
        ),
    }


def build_feedback(grievance):
    return {
        "rating": grievance.get("citizen_rating"),
        "comment": grievance.get("citizen_feedback"),
        "verified": grievance.get("citizen_verified"),
        "submitted_at": _iso(grievance.get("citizen_feedback_at")),
        # A citizen can rate the fix while it is being verified, and correct
        # that rating afterwards — see the feedback route for the same rule.
        "can_rate": grievance.get("status") in FEEDBACK_OPEN_STATUSES,
    }


def notification_history(grievance):
    """Everything we told the reporter about this case, newest first.

    Read from the notifications collection rather than reconstructed, so the
    page shows the messages that were actually sent — including the ones that
    came from a deadline warning or an appeal decision, which no field on the
    grievance document would have told them about.
    """
    target = grievance.get("citizen_id")
    if target is None:
        return []

    rows = list(notifications_collection.find(
        {"user_id": target, "related_grievance_id": grievance.get("grievance_id")},
        {"title": 1, "message": 1, "type": 1, "read": 1, "created_at": 1},
    ).sort("created_at", -1).limit(50))

    return [
        {
            "title": row.get("title"),
            "message": row.get("message"),
            "type": row.get("type"),
            "read": bool(row.get("read")),
            "created_at": _iso(row.get("created_at")),
        }
        for row in rows
    ]


def build_tracking_view(grievance, viewer=None):
    """The whole citizen tracking payload, built field by field.

    `viewer` only decides whether the owner-only actions (rate, withdraw,
    reopen) are offered. Every field in here is safe for the reporter to read
    whatever the viewer's role is, so staff get the identical projection —
    one definition of "what the citizen sees", no second copy to drift.
    """
    history = _public_history(grievance)
    stages, index, override = build_stages(grievance, history)
    latest = history[-1] if history else None
    submitted_at = grievance.get("created_at")

    is_owner = bool(viewer) and grievance.get("citizen_id") == viewer.get("_id")
    reopen = build_reopen(grievance)
    can_appeal = bool(grievance.get("flagged_invalid")) and grievance.get(
        "flag_appeal_status"
    ) in (None, "REJECTED") and (grievance.get("flag_appeal_count") or 0) < 2

    return {
        # --- identity ---
        "grievance_id": grievance.get("grievance_id"),
        "title": grievance.get("title"),
        "description": grievance.get("description"),
        "category": grievance.get("category"),
        "severity": grievance.get("severity"),
        "priority": grievance.get("priority"),
        "language": grievance.get("language"),
        "district": grievance.get("district"),

        # --- where, as the reporter gave it ---
        "location": {
            "address": (grievance.get("location") or {}).get("address"),
            "city": (grievance.get("location") or {}).get("city"),
            "pincode": (grievance.get("location") or {}).get("pincode"),
        },

        # --- status, in both vocabularies ---
        "status": grievance.get("status"),
        "stage": {
            "key": stages[index]["key"] if stages else None,
            "label": (override or {}).get("label") or (stages[index]["label"] if stages else None),
            "description": (stages[index]["description"] if stages else None),
            "index": index,
            "total": len(TRACKING_STAGES),
            # Counted from the very rungs the page draws, so the bar and the
            # ladder can never disagree: a case that stopped on a blocked rung
            # (rejected, withdrawn) has not finished that rung, and a case
            # standing on its current one has demonstrably reached it.
            "progress_percent": round(
                sum(1 for rung in stages if rung["state"] in ("done", "current"))
                / len(TRACKING_STAGES) * 100
            ),
            "state": stages[index]["state"] if stages else "pending",
        },
        "override": {
            "state": grievance.get("status"),
            "label": override["label"],
            "reason": grievance.get(override["reason_field"]) if override["reason_field"] else None,
            "at": _iso(grievance.get("updated_at")),
        } if override else None,
        "stages": stages,

        # --- dates ---
        "submitted_at": _iso(submitted_at),
        "latest_update_at": _iso(grievance.get("updated_at")),
        "latest_update": {
            "message": latest.get("message") if latest else None,
            "status": latest.get("status") if latest else None,
            "actor_role": latest.get("actor_role") if latest else None,
            "at": _iso(latest.get("timestamp")) if latest else None,
        },

        # --- routing ---
        "department": grievance.get("department"),
        "needs_department_review": bool(grievance.get("needs_department_review")),
        "ai_summary": grievance.get("ai_summary"),
        "officer": build_officer(grievance),

        # --- deadline ---
        "sla": build_sla(grievance),
        "predicted_resolution_hours": grievance.get("predicted_resolution_hours"),
        "escalation_risk": grievance.get("escalation_risk"),

        # --- resolution & proof ---
        "resolution": {
            "note": grievance.get("resolution_note"),
            "evidence": build_evidence(grievance),
            "submitted_at": _iso(grievance.get("resolved_at")),
        },

        # --- citizen side ---
        "feedback": build_feedback(grievance),
        "reopen": reopen,
        "remarks": build_remarks(grievance),
        "timeline": [
            {
                "status": entry.get("status"),
                "message": entry.get("message"),
                "actor_role": entry.get("actor_role"),
                "at": _iso(entry.get("timestamp")),
            }
            for entry in reversed(history)
        ],
        "notifications": notification_history(grievance),

        # --- false-report flag, in the words the citizen is owed ---
        # Deliberately not called "integrity": that name belongs to the
        # staff-only scoring block on the document, and reusing it here would
        # make a citizen payload look like the thing it must not contain.
        "flag": {
            "flagged": bool(grievance.get("flagged_invalid")),
            "reason": grievance.get("flagged_reason"),
            "appeal_status": grievance.get("flag_appeal_status"),
            "appeal_note": grievance.get("flag_appeal_note"),
        },
        "rejection": {
            "reason": grievance.get("rejection_reason"),
            "at": _iso(grievance.get("rejected_at")),
        } if grievance.get("status") == "REJECTED" else None,

        # --- what this viewer may do next ---
        "permissions": {
            "is_owner": is_owner,
            "can_give_feedback": is_owner and grievance.get("status") in FEEDBACK_OPEN_STATUSES,
            "can_request_reopen": reopen["can_request"] and is_owner,
            "can_withdraw": is_owner and (
                grievance.get("status") in DELETABLE_STATUSES
                and not grievance.get("assigned_officer")
            ),
            "can_appeal_flag": is_owner and can_appeal,
        },
    }
