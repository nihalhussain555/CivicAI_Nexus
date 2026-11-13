import uuid
import re
from datetime import datetime

from fastapi import HTTPException

from app.config.database import grievances_collection, users_collection, incidents_collection
from app.models.grievance import (
    grievance_document,
    assert_transition_allowed,
    REASON_REQUIRED_TRANSITIONS,
)
from app.services.ai_pipeline_service import run_pipeline
from app.services.classification_service import (
    canonical_department_or_raw,
    departments_equal,
)
from app.services.incident_service import cluster_grievance
from app.services.notification_service import notify
from app.services.audit_service import log_action
from app.services.authenticity_service import check_grievance_authenticity, LIKELY_FAKE
from app.services.trust_service import (
    compute_trust,
    enforce_volume_cap,
    submission_friction,
    refresh_trust,
)
from app.services.reward_service import award_valid_submission, award_community_confirmations
from app.services.voice_service import is_issued_audio_url, voice_preferences
from app.utils.geo import make_point


def make_grievance_id():
    return f"CIV-{datetime.utcnow():%Y}-{uuid.uuid4().hex[:8].upper()}"


# Used when a transition is a consequence of the workflow rather than of a
# person's decision — e.g. a citizen's "not resolved" verdict re-routes the
# case to the department. Attributing that to the citizen would let a role
# with no authority over routing appear in the audit trail as if it had one.
SYSTEM_ACTOR = {"_id": None, "role": "system", "name": "System", "district": None}


def history_entry(status, message, actor_role, timestamp=None, visibility="public"):
    """One append-only lifecycle record.

    Every write into grievance.history is built here — including the handful of
    endpoints that update Mongo directly for atomicity (case acceptance, where
    two officers can race for the same file). That is what lets the tracking
    page treat `history` as a complete, uniformly-shaped audit log instead of
    a best-effort guess with per-endpoint exceptions.
    """
    return {
        "status": status,
        "message": message,
        "actor_role": actor_role,
        # "internal" is for events that belong to the staff workflow, not the
        # citizen's story. redact_for_citizen drops them; the document keeps
        # both, which is the point of an audit history.
        "visibility": visibility,
        "timestamp": timestamp or datetime.utcnow(),
    }


def _notify_integrity_reviewers(grievance):
    """Tell the admins who can actually act on a suspicious case: the
    district's own admins, plus any super admin (district unset). Officers are
    deliberately not notified here — a fake-report judgment is not something a
    field officer gets to make on someone else's behalf."""
    reviewers = list(users_collection.find(
        {
            "role": "admin",
            "$or": [{"district": grievance.get("district")}, {"district": None}],
            "active": {"$ne": False},
        },
        {"_id": 1},
    ))

    for reviewer in reviewers:
        notify(
            reviewer["_id"],
            "Report needs an integrity review",
            (
                f"{grievance['grievance_id']} was scored "
                f"{(grievance.get('authenticity') or {}).get('score')}/100 for credibility "
                "and is waiting in the Integrity Review queue."
            ),
            notification_type="SLA_RISK",
            related_grievance_id=grievance["grievance_id"],
        )


def create_grievance(current_user: dict, data) -> dict:
    grievance_id = make_grievance_id()

    # `data.location` is a required field on GrievanceCreateRequest (with a
    # validated, non-optional `district`), so this is always present by
    # the time we get here — Pydantic rejects the request otherwise.
    location = make_point(
        data.location.latitude,
        data.location.longitude,
        data.location.address,
        city=getattr(data.location, "city", None),
        state=getattr(data.location, "state", None),
        pincode=getattr(data.location, "pincode", None),
        detection_method=getattr(data.location, "detection_method", None),
    )
    district = data.location.district

    # Trust is checked before anything expensive runs: an account with a
    # substantiated history of false reports is volume-capped, and every other
    # account just carries its standing into the integrity block below. This
    # never looks at the *content* of the report.
    trust = compute_trust(current_user["_id"])
    enforce_volume_cap(trust, trust["record"].get("submissions_today", 0))

    grievance = grievance_document(
        grievance_id=grievance_id,
        citizen_id=current_user["_id"],
        title=data.title.strip(),
        description=data.description.strip(),
        language=data.language,
        location=location,
        district=district,
    )

    if data.attachments:
        grievance["attachments"] = [a.model_dump() for a in data.attachments]

    # The speech model's guess and the recording behind it are machine
    # artifacts, not the citizen's statement — so the account's retention
    # settings decide whether they exist on the case at all. The approved
    # title and description above are kept whatever the switches say; a
    # complaint cannot be reviewed or appealed without them.
    retention = voice_preferences(current_user)
    kept_transcript = data.voice_transcript.strip()[:5000] if (
        retention["keep_transcript"] and data.voice_transcript
    ) else ""
    if kept_transcript:
        grievance["voice_transcript"] = kept_transcript
    if retention["keep_audio"] and is_issued_audio_url(data.voice_audio_url):
        grievance["voice_audio_url"] = data.voice_audio_url

    # --- run full AI pipeline ---
    combined_text = f"{data.title}. {data.description}"
    if kept_transcript:
        combined_text += f" {kept_transcript}"

    ai_result = run_pipeline(
        combined_text, language=data.language, citizen_id=current_user["_id"], location=location
    )

    now = datetime.utcnow()
    grievance.update({
        "translated_text": ai_result["translated_text"],
        "reported_language": ai_result["detected_language"],

        "category": ai_result["category"],
        "subcategory": ai_result["subcategory"],
        "severity": ai_result["severity"],
        "urgency_score": ai_result["urgency_score"],
        "priority": ai_result["priority"],
        "priority_score": ai_result["priority_score"],
        "confidence": ai_result["confidence"],
        "needs_department_review": ai_result["needs_department_review"],
        "ai_reason": ai_result["ai_reason"],
        "sentiment": ai_result["sentiment"],
        "ai_summary": ai_result["ai_summary"],
        "recommended_action": ai_result["recommended_action"],
        "ai_provider": ai_result["ai_provider"],

        "department": ai_result["department"],

        "duplicate": ai_result["duplicate"],
        "duplicate_score": ai_result["duplicate_score"],
        "duplicate_of": ai_result["duplicate_of"],
        "similar_cases": ai_result["similar_cases"],

        "predicted_resolution_hours": ai_result["predicted_resolution_hours"],
        "escalation_risk": ai_result["escalation_risk"],
        "sla_due_at": ai_result["sla_due_at"],

        # System auto-progresses SUBMITTED -> AI_ANALYZED -> DEPARTMENT_ASSIGNED
        # immediately after analysis; an officer must still explicitly accept.
        "status": "DEPARTMENT_ASSIGNED",
        "updated_at": now,
    })
    grievance["history"].extend([
        {
            "status": "AI_ANALYZED",
            "message": "AI analysis completed",
            "actor_role": "system",
            "visibility": "public",
            "timestamp": now,
        },
        {
            "status": "DEPARTMENT_ASSIGNED",
            "message": f"Routed to {ai_result['department']} ({district}) — AI-recommended",
            "actor_role": "system",
            "visibility": "public",
            "timestamp": now,
        },
    ])

    # Authenticity triage — a score + explanation for staff, never a
    # rejection. Runs after AI analysis so it can use category/priority, and it
    # writes back content_fingerprint + attachment signatures for future
    # collusion / recycled-evidence lookups.
    try:
        authenticity = check_grievance_authenticity(grievance)
    except Exception as error:
        print(f"WARNING: authenticity check failed: {error}")
        authenticity = None

    friction = submission_friction(trust, authenticity)

    if authenticity:
        grievance["authenticity"] = authenticity
        grievance["needs_authenticity_review"] = (
            authenticity["queue_for_review"] or friction["staff_first"]
        )

    # The account's standing at submission time, kept on the case so a
    # reviewing officer sees *why* this one was held, not just that it was.
    grievance["integrity"] = {
        "trust_score": trust.get("score"),
        "trust_label": trust.get("label"),
        "trust_level": trust.get("level"),
        "staff_first": friction["staff_first"],
        "evidence_expected": friction["evidence_expected"],
        "points_held": friction["hold_points"] or bool(
            authenticity and authenticity["verdict"] == LIKELY_FAKE
        ),
        "reason": friction["reason"],
        "basis": authenticity.get("basis") if authenticity else None,
    }
    points_held = grievance["integrity"]["points_held"]

    # The citizen ladder's "Verified" step. A report that automated screening
    # cleared is confirmed as a genuine civic issue at submission; a report held
    # for a human is only confirmed once that human decides (integrity triage,
    # or an officer accepting the case) — see verified_at elsewhere in this file.
    if not grievance["needs_authenticity_review"]:
        grievance["verified_at"] = now

    grievances_collection.insert_one(grievance)

    # Civic rewards: +10 for a genuine, non-duplicate submission (and the
    # one-time first-valid-grievance bonus). Duplicates earn nothing — see
    # award_valid_submission for the exact gating.
    # Points are held back for likely-fake reports, and for any report from a
    # low-trust account that the scorer wasn't confident about. Not a penalty:
    # if an officer later accepts the case, the held submission award is paid
    # then (see the accept endpoint) and the verified/resolved awards still pay
    # out normally. Human adjudication, not the score, is the final word.
    if not points_held:
        award_valid_submission(grievance)

    # community incident clustering (requires the grievance to already exist)
    incident = cluster_grievance(grievance)
    if incident:
        grievance["incident_id"] = incident["incident_id"]

        # Re-fetch so we have the authoritative, post-clustering member list
        # regardless of which branch cluster_grievance took internally.
        fresh_incident = incidents_collection.find_one({"incident_id": incident["incident_id"]})
        if fresh_incident:
            member_docs = grievances_collection.find(
                {"grievance_id": {"$in": fresh_incident.get("grievance_ids", [])}},
                {"citizen_id": 1},
            )
            distinct_citizens = {doc["citizen_id"] for doc in member_docs}
            # +5 "community confirms" to every distinct citizen behind the
            # incident, once each — never farmable by resubmitting, since
            # it's driven entirely by the existing geo/category clustering
            # across *different* citizen accounts.
            award_community_confirmations(fresh_incident, distinct_citizens)

    notify(
        current_user["_id"],
        "Grievance Submitted",
        f"Your grievance {grievance_id} was submitted and routed to {ai_result['department']} ({district})."
        + (
            " An officer will confirm the location before the team is dispatched, so "
            "please keep your photos handy."
            if points_held
            else ""
        ),
        notification_type="SUCCESS",
        related_grievance_id=grievance_id,
    )

    # Tell the people who can act on it, now rather than whenever they next
    # open the queue.
    if grievance.get("needs_authenticity_review"):
        _notify_integrity_reviewers(grievance)

    log_action(current_user["_id"], current_user["role"], "GRIEVANCE_CREATED", "grievance", grievance_id)

    return grievance


def release_held_submission_award(grievance):
    """Pay the +10 that fake-report suspicion withheld, once a human has
    treated the case as real work.

    Called from the accept/assign paths: an officer picking a case up is the
    strongest available evidence that the report wasn't fabricated, and it
    would be incoherent for the scoring model to have permanently suppressed a
    reward that an authority has just overridden by acting on the report."""
    integrity = grievance.get("integrity") or {}
    if not integrity.get("points_held"):
        return

    award_valid_submission(grievance)
    grievances_collection.update_one(
        {"grievance_id": grievance["grievance_id"]},
        {"$set": {
            "integrity.points_held": False,
            "integrity.released_on_review": True,
        }},
    )


def get_grievance_or_404(grievance_id: str) -> dict:
    grievance = grievances_collection.find_one({"grievance_id": grievance_id})
    if not grievance:
        raise HTTPException(status_code=404, detail="Grievance not found")
    return grievance


def assert_can_view(grievance: dict, current_user: dict):
    role = current_user["role"]

    # ---------------------------------------------------------
    # CITIZEN
    # ---------------------------------------------------------

    if role == "citizen":
        if grievance.get("citizen_id") != current_user["_id"]:
            raise HTTPException(
                status_code=403,
                detail="You can only view your own grievances",
            )

        return

    # ---------------------------------------------------------
    # OFFICER
    # ---------------------------------------------------------

    if role == "officer":

        if not departments_equal(
            grievance.get("department"),
            current_user.get("department"),
        ):
            raise HTTPException(
                status_code=403,
                detail="This case belongs to a different department",
            )

        grievance_district = grievance.get("district")
        officer_district = current_user.get("district")

        if (
            grievance_district
            and officer_district
            and grievance_district != officer_district
        ):
            raise HTTPException(
                status_code=403,
                detail="This case belongs to a different district",
            )

        assigned_officer = grievance.get(
            "assigned_officer"
        )

        if (
            assigned_officer
            and assigned_officer != current_user["_id"]
        ):
            raise HTTPException(
                status_code=403,
                detail="This grievance is assigned to another officer",
            )

        return

    # ---------------------------------------------------------
    # DISTRICT ADMIN
    # ---------------------------------------------------------

    if role == "admin":

        admin_district = current_user.get(
            "district"
        )

        if admin_district:

            if grievance.get("district") != admin_district:
                raise HTTPException(
                    status_code=403,
                    detail="This grievance belongs to another district",
                )

        return


def transition_status(
    grievance: dict,
    new_status: str,
    actor: dict,
    message: str = None,
    extra_fields: dict = None,
    visibility: str = "public",
):
    """The only sanctioned way to move a grievance between lifecycle states.

    Everything the citizen's tracking page promises about status integrity is
    paid for here: one legality check, one authority check, one append-only
    history entry, one audit log line, one notification. Endpoints that update
    `status` without going through this function are the bug, not the design.
    """
    current_status = grievance["status"]

    try:
        assert_transition_allowed(current_status, new_status, actor["role"])
    except PermissionError as error:
        raise HTTPException(status_code=403, detail=str(error))
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

    if new_status in REASON_REQUIRED_TRANSITIONS and not (message or "").strip():
        raise HTTPException(
            status_code=400,
            detail=f"A reason is required when moving a case to {new_status.replace('_', ' ').title()}",
        )

    # ---------------------------------------------------------
    # DISTRICT ADMIN SECURITY
    # ---------------------------------------------------------

    if (
        actor["role"] == "admin"
        and actor.get("district")
        and grievance.get("district")
        != actor.get("district")
    ):
        raise HTTPException(
            status_code=403,
            detail="You cannot modify grievances outside your district",
        )

    # ---------------------------------------------------------
    # OFFICER SECURITY
    # ---------------------------------------------------------

    if actor["role"] == "officer":

        assigned = grievance.get("assigned_officer")

        if assigned and assigned != actor["_id"]:
            raise HTTPException(
                status_code=403,
                detail="You can only modify grievances assigned to you",
            )

        # An unassigned case is the department's shared queue, so any officer in
        # it may act on it — that is how a report gets rejected as out of scope
        # or escalated before anyone has taken it. The department and district
        # match that makes this true is assert_can_view's job, done at the
        # endpoint; here we only have to stop anyone steering a colleague's
        # case.

    now = datetime.utcnow()

    history_item = history_entry(
        new_status,
        message or f"Status changed to {new_status}",
        actor["role"],
        timestamp=now,
        visibility=visibility,
    )

    update_fields = {
        "status": new_status,
        "updated_at": now,
    }

    if extra_fields:
        update_fields.update(
            extra_fields
        )

    grievances_collection.update_one(
        {
            "grievance_id":
                grievance["grievance_id"]
        },
        {
            "$set": update_fields,
            "$push": {
                "history": history_item
            },
        },
    )

    log_action(
        actor["_id"],
        actor["role"],
        "GRIEVANCE_STATUS_CHANGE",
        "grievance",
        grievance["grievance_id"],
        {
            "from": current_status,
            "to": new_status,
        },
    )

    notify(
        grievance["citizen_id"],
        "Grievance Update",
        (
            f"Grievance "
            f"{grievance['grievance_id']} "
            f"is now "
            f"{new_status.replace('_', ' ').title()}."
        ),
        notification_type="STATUS_CHANGE",
        related_grievance_id=
            grievance["grievance_id"],
    )

    return grievances_collection.find_one(
        {
            "grievance_id":
                grievance["grievance_id"]
        }
    )


def build_list_query(
    current_user,
    status=None,
    category=None,
    department=None,
    priority=None,
    search=None,
):
    query = {}

    role = current_user["role"]

    # ---------------------------------------------------------
    # CITIZEN
    # ---------------------------------------------------------

    if role == "citizen":
        query["citizen_id"] = current_user["_id"]

    # ---------------------------------------------------------
    # OFFICER
    # ---------------------------------------------------------

    elif role == "officer":

        # Officer user documents may store a legacy department name while
        # grievances always store the canonical one.
        query["department"] = canonical_department_or_raw(
            current_user.get(
                "department"
            )
        )

        if current_user.get("district"):
            query["district"] = current_user.get(
                "district"
            )

    # ---------------------------------------------------------
    # ADMIN
    # ---------------------------------------------------------

    elif role == "admin":

        # District Admin
        if current_user.get("district"):
            query["district"] = current_user[
                "district"
            ]

    if status:
        # One status is an exact match. A comma-separated list means "any of
        # these", which is how the citizen's own list asks for a group of
        # statuses at once — "In progress" is eight of the twelve, and the
        # alternative is eight round trips or a filter that lies about what it
        # showed. Values are matched as data, never as operators.
        wanted = [token.strip() for token in status.split(",") if token.strip()]
        if len(wanted) == 1:
            query["status"] = wanted[0]
        elif wanted:
            query["status"] = {"$in": wanted}
    elif role == "citizen":
        # Deleted/withdrawn grievances shouldn't linger in the citizen's
        # own list by default — that's the whole point of deleting one.
        # Still fully queryable by explicitly filtering status=WITHDRAWN.
        query["status"] = {"$ne": "WITHDRAWN"}

    if category:
        query["category"] = category

    if department:
        # District admin can filter departments
        # inside their own district.
        if role in ("admin",):
            query["department"] = department

    if priority:
        query["priority"] = priority

    if search:
        # Match either a keyword in the title/description (via the text
        # index) OR the grievance's reference ID directly — officers get
        # quoted IDs like "CIV-2026-3F7BDDD8" over the phone constantly,
        # and a text index alone won't match those.
        query["$or"] = [
            {"$text": {"$search": search}},
            {"grievance_id": {"$regex": re.escape(search), "$options": "i"}},
        ]

    return query


def paginate(collection, query, page=1, limit=20, sort_field="created_at", sort_dir=-1):
    page = max(1, page)
    limit = max(1, min(100, limit))
    skip = (page - 1) * limit

    total = collection.count_documents(query)
    items = list(
        collection.find(query).sort(sort_field, sort_dir).skip(skip).limit(limit)
    )

    return {
        "items": items,
        "page": page,
        "limit": limit,
        "total": total,
        "total_pages": (total + limit - 1) // limit if limit else 0,
    }