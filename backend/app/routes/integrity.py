"""
Integrity review surface — everything a staff member or citizen can *do*
about a suspected fake grievance, as opposed to how it is detected (see
authenticity_service).

Why these live apart from routes/grievances.py: the grievance router is the
case lifecycle (accept → resolve → verify → close). Nothing here changes a
case's status. It changes what the platform believes about a report, which in
turn changes who has to look at it and whether it earns civic points. Keeping
the two apart is also what stops a fake-report review from being mistaken for
an officer accepting a case.

Shared principles across every endpoint here:
  - A human decision outranks the scorer, in both directions. "GENUINE" clears
    the flag and pays back what was withheld; "FAKE" flags it. Either way the
    scorer's own output is recorded as it was, and the human call is recorded
    alongside it — that pair is the only honest measure of whether the
    detection is any good.
  - Nothing here deletes a report. A flagged grievance stays visible to its
    citizen and stays in the department's numbers; it just earns nothing and
    is marked.
  - Citizens are told a decision was made and why in plain words, never shown
    the signals or weights (see STAFF_ONLY_FIELDS).
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query

from app.config.database import grievances_collection, users_collection
from app.models.grievance import MAX_FLAG_APPEALS
from app.schemas.grievance import (
    FlagAppealRequest,
    FlagAppealReviewRequest,
    FlagReversalRequest,
    IntegrityTriageRequest,
)
from app.services.audit_service import log_action
from app.services.grievance_service import (
    assert_can_view,
    build_list_query,
    get_grievance_or_404,
    paginate,
)
from app.services.notification_service import notify
from app.services.reward_service import (
    award_valid_submission,
    flag_false_report,
    reverse_false_report_flag,
)
from app.services.trust_service import refresh_trust
from app.utils.dependencies import require_staff, get_current_user
from app.utils.helpers import serialize_document, serialize_documents


router = APIRouter(prefix="/api/grievances", tags=["Integrity"])


def _history_entry(grievance, message, actor_role):
    return {
        "status": grievance["status"],
        "message": message,
        "actor_role": actor_role,
        "timestamp": datetime.utcnow(),
    }


def _flagged_by_name(grievance):
    actor_id = grievance.get("flagged_by")
    if not actor_id:
        return None
    actor = users_collection.find_one({"_id": actor_id}, {"name": 1, "role": 1})
    if not actor:
        return None
    return {"name": actor.get("name"), "role": actor.get("role")}


def _require_staff_scope(grievance, current_user):
    """Only staff whose remit covers the case may adjudicate it — same rule
    that guards viewing, reused so an officer from another department can't
    'review' a case into or out of the queue."""
    assert_can_view(grievance, current_user)


@router.get("/integrity/queue")
def integrity_queue(
    verdict: str = Query(None, description="LIKELY_FAKE | NEEDS_REVIEW | LIKELY_GENUINE"),
    district: str = None,
    department: str = None,
    search: str = None,
    only_appeals: bool = False,
    include_cleared: bool = False,
    page: int = 1,
    limit: int = 20,
    current_user=Depends(require_staff),
):
    """The review queue: reports the platform is not sure about, most
    suspicious first.

    Ordered by ascending credibility score rather than newest-first, because
    the point of this screen is triage — the worst candidates should be at the
    top of the list, not somewhere on page four.

    `only_appeals` switches to the other half of the job: citizens contesting
    a flag, which is oldest-first, since an appeal left sitting is the one
    thing here that has a real cost to the citizen.
    """
    query = build_list_query(current_user, department=department, search=search)

    if only_appeals:
        query["flag_appeal_status"] = "PENDING"
        sort_field, sort_dir = "flag_appeal_requested_at", 1
    else:
        if not include_cleared:
            query["needs_authenticity_review"] = True
        if verdict:
            query["authenticity.verdict"] = verdict.upper()
        if district:
            query["district"] = district
        sort_field, sort_dir = "authenticity.score", 1

    result = paginate(grievances_collection, query, page, limit, sort_field, sort_dir)

    # Counts for the whole scoped set, not the filtered slice, so the tabs can
    # show real numbers and a filter never makes the queue look emptier than
    # it is.
    scope = build_list_query(current_user)
    counts = {}
    for name in ("LIKELY_FAKE", "NEEDS_REVIEW", "LIKELY_GENUINE"):
        counts[name] = grievances_collection.count_documents({
            **scope,
            "needs_authenticity_review": True,
            "authenticity.verdict": name,
        })
    counts["appeals_pending"] = grievances_collection.count_documents({
        **scope, "flag_appeal_status": "PENDING",
    })
    counts["flagged_total"] = grievances_collection.count_documents({
        **scope, "flagged_invalid": True,
    })

    items = []
    for grievance in result["items"]:
        citizen = users_collection.find_one(
            {"_id": grievance.get("citizen_id")},
            {"name": 1, "email": 1, "trust": 1, "created_at": 1},
        ) or {}
        authenticity = grievance.get("authenticity") or {}
        items.append({
            **serialize_document(grievance),
            "citizen": {
                "name": citizen.get("name"),
                "email": citizen.get("email"),
                "trust": citizen.get("trust"),
                "member_since": citizen.get("created_at"),
            },
            "flagged_by_staff": _flagged_by_name(grievance),
            # Pre-flattened for the list row so the queue doesn't have to
            # re-derive what made a case suspicious from the full breakdown.
            "top_signals": [
                s for s in (authenticity.get("signals") or []) if s.get("impact", 0) < 0
            ][:3],
        })

    result["items"] = serialize_documents(items)
    result["queue_counts"] = counts

    return {"success": True, "data": result}


@router.put("/{grievance_id}/integrity/triage")
def triage_grievance(
    grievance_id: str,
    data: IntegrityTriageRequest,
    current_user=Depends(require_staff),
):
    """The one action that closes the loop: a human answers the question the
    scorer asked.

    GENUINE  → review flag cleared, any withheld submission points released,
               and the case routes normally from here on.
    FAKE     → equivalent to flag-invalid (points reversed, citizen notified),
               plus the scored breakdown is preserved for the record.

    The scorer's original verdict is kept on the document under
    `authenticity.human_decision` — the gap between the two across many cases
    is how you'd know whether to retune the weights.
    """
    grievance = get_grievance_or_404(grievance_id)
    _require_staff_scope(grievance, current_user)

    now = datetime.utcnow()
    decision = data.decision.upper()

    if decision == "GENUINE":
        updates = {
            "needs_authenticity_review": False,
            "flagged_invalid": False,
            "flag_reversed_at": now,
            "flag_reversed_by": current_user["_id"],
            "flag_reversal_note": data.note or "Confirmed genuine on integrity review.",
            "integrity.staff_first": False,
            "integrity.points_held": False,
            "integrity.human_decision": "GENUINE",
            "integrity.human_decision_at": now,
            "integrity.human_decision_by": current_user["_id"],
            "updated_at": now,
        }
        grievances_collection.update_one(
            {"grievance_id": grievance_id},
            {
                "$set": updates,
                "$push": {"history": _history_entry(
                    grievance,
                    f"Integrity review: confirmed genuine by {current_user['name']}."
                    + (f" {data.note}" if data.note else ""),
                    current_user["role"],
                )},
            },
        )

        # Give back anything the suspicion withheld.
        if grievance.get("flagged_invalid"):
            reverse_false_report_flag(grievance, current_user)
        elif not grievance.get("duplicate"):
            award_valid_submission(grievance)

        message = (
            f"A review officer confirmed that {grievance_id} is a genuine report. "
            "Any civic points held back for it have been released."
        )
        log_action(current_user["_id"], current_user["role"],
                   "GRIEVANCE_INTEGRITY_CONFIRMED", "grievance", grievance_id,
                   {"decision": decision, "note": data.note})
    else:
        if grievance.get("flagged_invalid"):
            raise HTTPException(
                status_code=400,
                detail="This grievance has already been flagged.",
            )

        grievances_collection.update_one(
            {"grievance_id": grievance_id},
            {
                "$set": {
                    "flagged_invalid": True,
                    "flagged_reason": data.note or "Marked false on integrity review.",
                    "flagged_by": current_user["_id"],
                    "flagged_at": now,
                    "needs_authenticity_review": False,  # decided, not pending
                    "integrity.staff_first": False,
                    "integrity.points_held": True,
                    "integrity.human_decision": "FAKE",
                    "integrity.human_decision_at": now,
                    "integrity.human_decision_by": current_user["_id"],
                    "updated_at": now,
                },
                "$push": {"history": _history_entry(
                    grievance,
                    f"Integrity review: marked false/misleading by {current_user['name']}."
                    + (f" {data.note}" if data.note else ""),
                    current_user["role"],
                )},
            },
        )

        flag_false_report(grievance, current_user)

        message = (
            f"Grievance {grievance_id} was reviewed and marked false or misleading. "
            "Any civic points earned for it have been reversed."
        )
        log_action(current_user["_id"], current_user["role"],
                   "GRIEVANCE_INTEGRITY_REJECTED", "grievance", grievance_id,
                   {"decision": decision, "note": data.note})

    refresh_trust(grievance["citizen_id"])

    notify(
        grievance["citizen_id"],
        "Integrity review complete",
        message,
        notification_type="INFO",
        related_grievance_id=grievance_id,
    )

    updated = get_grievance_or_404(grievance_id)
    return {
        "success": True,
        "message": message,
        "data": serialize_document(updated),
    }


@router.put("/{grievance_id}/unflag")
def unflag_grievance(
    grievance_id: str,
    data: FlagReversalRequest,
    current_user=Depends(require_staff),
):
    """Staff-side correction: undo a false-report flag without the citizen
    having to appeal. A flag is a deduction of both points and trust, so it
    needs a way back that isn't only the citizen's initiative."""
    grievance = get_grievance_or_404(grievance_id)
    _require_staff_scope(grievance, current_user)

    if not grievance.get("flagged_invalid"):
        raise HTTPException(
            status_code=400,
            detail="This grievance is not flagged, so there is nothing to reverse.",
        )

    now = datetime.utcnow()
    grievances_collection.update_one(
        {"grievance_id": grievance_id},
        {
            "$set": {
                "flagged_invalid": False,
                "flag_reversed_at": now,
                "flag_reversed_by": current_user["_id"],
                "flag_reversal_note": data.note,
                "integrity.points_held": False,
                "updated_at": now,
            },
            "$unset": {
                # Cleared rather than left as a stale trail: the history entry
                # below is the durable record of both the flag and its
                # reversal, and `flagged_reason` describing a flag that no
                # longer exists is just noise.
                "flagged_by": "",
                "flagged_at": "",
            },
            "$push": {"history": _history_entry(
                grievance,
                f"False-report flag reversed by {current_user['name']}: {data.note}",
                current_user["role"],
            )},
        },
    )

    reverse_false_report_flag(grievance, current_user)
    refresh_trust(grievance["citizen_id"])

    message = (
        f"The false-report flag on grievance {grievance_id} was reversed by staff. "
        "Your points for it have been restored."
    )
    notify(grievance["citizen_id"], "Flag reversed", message,
           notification_type="SUCCESS", related_grievance_id=grievance_id)
    log_action(current_user["_id"], current_user["role"], "GRIEVANCE_UNFLAGGED",
               "grievance", grievance_id, {"note": data.note})

    updated = get_grievance_or_404(grievance_id)
    return {"success": True, "message": message, "data": serialize_document(updated)}


@router.post("/{grievance_id}/flag-appeal")
def create_flag_appeal(
    grievance_id: str,
    data: FlagAppealRequest,
    current_user=Depends(get_current_user),
):
    """Citizen contests a false-report flag. Mirrors the reopen-request flow:
    the citizen asks, staff decide, nothing is self-service."""
    grievance = get_grievance_or_404(grievance_id)

    if grievance.get("citizen_id") != current_user["_id"]:
        raise HTTPException(status_code=403, detail="You can only appeal your own grievance")

    if not grievance.get("flagged_invalid"):
        raise HTTPException(
            status_code=400,
            detail="This grievance has not been flagged, so there is nothing to appeal.",
        )

    if grievance.get("flag_appeal_status") == "PENDING":
        raise HTTPException(
            status_code=400,
            detail="An appeal for this grievance is already waiting to be reviewed.",
        )

    if grievance.get("flag_appeal_count", 0) >= MAX_FLAG_APPEALS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"This grievance has already been appealed {MAX_FLAG_APPEALS} time(s). "
                "Two reviewers have upheld the flag, so the decision stands."
            ),
        )

    now = datetime.utcnow()
    grievances_collection.update_one(
        {"grievance_id": grievance_id},
        {
            "$set": {
                "flag_appeal_status": "PENDING",
                "flag_appeal_reason": data.reason,
                "flag_appeal_requested_at": now,
                "flag_appeal_note": None,
                "flag_appeal_reviewed_by": None,
                "flag_appeal_reviewed_at": None,
                "updated_at": now,
            },
            "$push": {"history": _history_entry(
                grievance, "Citizen appealed the false-report flag.", "citizen",
            )},
        },
    )

    # Tell the staff who can decide it — the same audience as the queue.
    reviewers = users_collection.find(
        {"role": "admin",
         "$or": [{"district": grievance.get("district")}, {"district": None}],
         "active": {"$ne": False}},
        {"_id": 1},
    )
    for reviewer in reviewers:
        notify(
            reviewer["_id"],
            "Flag appeal received",
            f"{current_user['name']} appealed the flag on {grievance_id} "
            "and is waiting for a decision.",
            notification_type="SLA_RISK",
            related_grievance_id=grievance_id,
        )

    log_action(current_user["_id"], "citizen", "GRIEVANCE_FLAG_APPEALED",
               "grievance", grievance_id, {"reason": data.reason})

    updated = get_grievance_or_404(grievance_id)
    return {
        "success": True,
        "message": "Your appeal was sent for review. You'll be notified when a decision is made.",
        "data": serialize_document(updated),
    }


@router.put("/{grievance_id}/flag-appeal/review")
def review_flag_appeal(
    grievance_id: str,
    data: FlagAppealReviewRequest,
    current_user=Depends(require_staff),
):
    """Decide an appeal. Approving it reverses the flag (and restores points,
    and counts toward the account's trust as a corrected staff decision
    rather than as a strike)."""
    grievance = get_grievance_or_404(grievance_id)
    _require_staff_scope(grievance, current_user)

    if grievance.get("flag_appeal_status") != "PENDING":
        raise HTTPException(
            status_code=400,
            detail="There is no pending appeal on this grievance.",
        )

    now = datetime.utcnow()
    status = "APPROVED" if data.approve else "REJECTED"

    set_fields = {
        "flag_appeal_status": status,
        "flag_appeal_reviewed_by": current_user["_id"],
        "flag_appeal_reviewed_at": now,
        "flag_appeal_note": data.note,
        "updated_at": now,
    }

    if data.approve:
        # The appeal winning means the flag was wrong — clear it in the same
        # write, so there is no window where a case is both 'unflagged by the
        # appeal' and 'still flagged'.
        set_fields.update({
            "flagged_invalid": False,
            "flag_reversed_at": now,
            "flag_reversed_by": current_user["_id"],
            "flag_reversal_note": f"Flag overturned on citizen appeal: {data.note}",
            "integrity.points_held": False,
            "integrity.human_decision": "GENUINE",
            "integrity.human_decision_at": now,
            "integrity.human_decision_by": current_user["_id"],
        })

    grievances_collection.update_one(
        {"grievance_id": grievance_id},
        {
            "$set": set_fields,
            "$inc": {"flag_appeal_count": 1},
            "$push": {"history": _history_entry(
                grievance,
                f"Flag appeal {status.lower()} by {current_user['name']}: {data.note}",
                current_user["role"],
            )},
        },
    )

    if data.approve:
        reverse_false_report_flag(grievance, current_user)

    refresh_trust(grievance["citizen_id"])

    if data.approve:
        citizen_message = (
            f"Your appeal on {grievance_id} was accepted — the flag has been removed "
            "and your points restored."
        )
        staff_notification = None
    else:
        citizen_message = (
            f"Your appeal on {grievance_id} was not accepted. "
            f"Reviewing officer: {data.note}"
        )
        staff_notification = (
            "An appeal was rejected, so the report stands as flagged. If the citizen "
            "has new evidence, they can appeal again."
        )

    notify(
        grievance["citizen_id"],
        "Flag appeal decided",
        citizen_message,
        notification_type="SUCCESS" if data.approve else "INFO",
        related_grievance_id=grievance_id,
    )

    log_action(current_user["_id"], current_user["role"], "GRIEVANCE_FLAG_APPEAL_REVIEWED",
               "grievance", grievance_id, {"status": status, "note": data.note})

    updated = get_grievance_or_404(grievance_id)
    return {
        "success": True,
        "message": f"Appeal {status.lower()}.",
        "data": serialize_document(updated),
        "note_for_staff": staff_notification,
    }
