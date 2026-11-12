from datetime import datetime
from uuid import uuid4


# Valid grievance lifecycle states (see spec: GRIEVANCE STATES)
GRIEVANCE_STATES = [
    "SUBMITTED",
    "AI_ANALYZED",
    "DEPARTMENT_ASSIGNED",
    "OFFICER_ACCEPTED",
    "IN_PROGRESS",
    "RESOLUTION_SUBMITTED",
    "CITIZEN_VERIFICATION",
    "CLOSED",
    "REJECTED",
    "REOPENED",
    "ESCALATED",
]

# Allowed forward transitions. Kept explicit so the API can reject
# a status change that doesn't make sense for the domain.
VALID_TRANSITIONS = {
    "SUBMITTED": {"AI_ANALYZED", "WITHDRAWN", "REJECTED"},
    "AI_ANALYZED": {"DEPARTMENT_ASSIGNED", "WITHDRAWN", "REJECTED"},
    "DEPARTMENT_ASSIGNED": {"OFFICER_ACCEPTED", "ESCALATED", "WITHDRAWN", "REJECTED"},
    "OFFICER_ACCEPTED": {"IN_PROGRESS", "ESCALATED", "REJECTED"},
    "IN_PROGRESS": {"RESOLUTION_SUBMITTED", "ESCALATED", "REJECTED"},
    "RESOLUTION_SUBMITTED": {"CITIZEN_VERIFICATION"},
    "CITIZEN_VERIFICATION": {"CLOSED", "REOPENED"},
    "REOPENED": {"DEPARTMENT_ASSIGNED", "OFFICER_ACCEPTED", "IN_PROGRESS"},
    "ESCALATED": {"OFFICER_ACCEPTED", "IN_PROGRESS", "DEPARTMENT_ASSIGNED", "REJECTED"},
    # Once the reporter has confirmed the fix, the only way back into the
    # pipeline is the department reopening the case itself (see the staff-only
    # edge below) — never the citizen, and never into any other state.
    "CLOSED": {"REOPENED"},
    # Terminal — a citizen can only delete/withdraw a grievance before an
    # officer has accepted it (see the DELETE endpoint). No transitions
    # out of WITHDRAWN; if the issue still needs reporting, file a new one.
    "WITHDRAWN": set(),
    # Terminal — staff judged the report not actionable and said why. The
    # only way back into the pipeline is a fresh report.
    "REJECTED": set(),
}

# Who is allowed to drive each transition. VALID_TRANSITIONS answers "is this
# move legal"; this answers "is *you* the one who may make it". A citizen can
# only ever act at the two verification steps on their own case; everything
# else is staff work. Checked in grievance_service.transition_status, so an
# endpoint that forgets its own role check still cannot smuggle a move through.
TRANSITION_AUTHORITY = {
    "AI_ANALYZED": {"system"},
    "DEPARTMENT_ASSIGNED": {"system", "officer", "admin"},
    "OFFICER_ACCEPTED": {"officer", "admin"},
    "IN_PROGRESS": {"officer", "admin"},
    "RESOLUTION_SUBMITTED": {"officer", "admin"},
    "CITIZEN_VERIFICATION": {"officer", "admin"},
    "ESCALATED": {"officer", "admin"},
    "REJECTED": {"officer", "admin"},
    "CLOSED": {"citizen"},
    # "Reopened" means two different things depending on where the case is
    # coming from, so the role rule is edge-aware rather than state-shaped:
    # see STAFF_REOPEN_FROM.
    "REOPENED": {"citizen", "officer", "admin"},
    "WITHDRAWN": {"citizen"},
}

# Transitions that only make sense with a written reason attached, because
# the citizen is going to read it and decide what to do next.
REASON_REQUIRED_TRANSITIONS = {"REJECTED", "REOPENED"}

# Reopening after the reporter has already confirmed the fix is the
# department's decision, not the citizen's button. It re-routes the file,
# reverses the resolution reward and restarts the SLA clock, so it is opened
# from the case file by staff who can act on it. Before that confirmation —
# while the case is still in the verification step — "not resolved" is the
# citizen's own answer to the department's claim and stays theirs to give.
STAFF_REOPEN_FROM = {"CLOSED"}

# --- Citizen-facing tracking ladder -------------------------------------
# The internal states above are workflow bookkeeping; a citizen thinking about
# their pothole does not think in "DEPARTMENT_ASSIGNED". TRACKING_STAGES is the
# single place that translates one into the other, so the API, the tracking
# page and any future letterhead all say the same thing about the same case.
#
# "Verified" has no state of its own: a report is verified the moment the
# screening it went through (AI authenticity + duplicate check) is cleared,
# either automatically at submission or by a human in integrity review. That
# moment is stored in `verified_at`, and the stage stays open until then.
TRACKING_STAGES = [
    {"key": "SUBMITTED", "label": "Submitted", "description": "We have your report."},
    {"key": "AI_PROCESSING", "label": "AI Processing", "description": "The report was read, classified and routed."},
    {"key": "VERIFIED", "label": "Verified", "description": "The report was confirmed as a genuine civic issue."},
    {"key": "ASSIGNED", "label": "Assigned", "description": "A department owns the case."},
    {"key": "IN_PROGRESS", "label": "In Progress", "description": "Field work is underway."},
    {"key": "RESOLUTION_SUBMITTED", "label": "Resolution Submitted", "description": "The department says the work is done."},
    {"key": "CITIZEN_FEEDBACK", "label": "Citizen Feedback", "description": "Waiting for you to confirm and rate the fix."},
    {"key": "RESOLVED", "label": "Resolved", "description": "Closed with your confirmation."},
]

TRACKING_STAGE_KEYS = [stage["key"] for stage in TRACKING_STAGES]

# Internal state -> ladder position. Exception states (REOPENED, ESCALATED,
# REJECTED, WITHDRAWN) are not on the ladder; they are reported alongside the
# furthest stage the case actually reached, which is why escalate/reject read
# history rather than guessing.
STAGE_INDEX_BY_STATUS = {
    "SUBMITTED": 0,
    "AI_ANALYZED": 1,
    "DEPARTMENT_ASSIGNED": 3,
    "OFFICER_ACCEPTED": 3,
    "IN_PROGRESS": 4,
    "RESOLUTION_SUBMITTED": 5,
    "CITIZEN_VERIFICATION": 6,
    "CLOSED": 7,
}

# States that sit outside the happy path but still deserve to be named out loud.
OVERRIDE_STATES = {
    "REOPENED": {
        "label": "Reopened",
        "reason_field": "reopen_reason",
        "note_field": None,
    },
    "ESCALATED": {
        "label": "Escalated",
        "reason_field": None,
        "note_field": None,
    },
    "REJECTED": {
        "label": "Rejected",
        "reason_field": "rejection_reason",
        "note_field": None,
    },
    "WITHDRAWN": {
        "label": "Withdrawn",
        "reason_field": None,
        "note_field": None,
    },
}


def make_remark_id():
    return f"REM-{uuid4().hex[:12].upper()}"


def remark_document(
    text,
    audience,
    author_id,
    author_name,
    author_role,
    department=None,
    district=None,
):
    """One staff remark on a grievance.

    `author_name` is kept for staff readers only — the citizen-facing tracking
    projection rebuilds a department+district designation from these fields and
    never shows the person's name, id or contact details.
    """
    return {
        "remark_id": make_remark_id(),
        "text": text,
        "audience": audience,              # PUBLIC | INTERNAL
        "author_id": author_id,
        "author_name": author_name,
        "author_role": author_role,
        "department": department,
        "district": district,
        "created_at": datetime.utcnow(),
    }

def assert_transition_allowed(current_status, new_status, actor_role):
    """The one legal-and-authorised question every status change must pass.

    Returns nothing; raises ValueError with a citizen-safe explanation when the
    move is illegal (bad edge) or unauthorised (right edge, wrong person). Call
    sites translate that into 400/403 — see grievance_service.transition_status.
    """
    if new_status not in VALID_TRANSITIONS.get(current_status, set()):
        raise ValueError(
            f"Cannot move a grievance from {current_status} to {new_status}"
        )

    # The one transition whose permission depends on the edge rather than the
    # target state: a citizen may reject a fix that is still in front of them,
    # but not reopen a case they already said was resolved.
    if (
        new_status == "REOPENED"
        and current_status in STAFF_REOPEN_FROM
        and actor_role == "citizen"
    ):
        raise PermissionError(
            "A confirmed resolution can only be reopened by the department"
        )

    allowed_roles = TRANSITION_AUTHORITY.get(new_status)
    if allowed_roles is not None and actor_role not in allowed_roles:
        raise PermissionError(
            f"A {actor_role} cannot move a grievance to {new_status}"
        )


# Statuses in which no officer has accepted the case yet — a citizen may
# still delete/withdraw the grievance during any of these.
DELETABLE_STATUSES = {"SUBMITTED", "AI_ANALYZED", "DEPARTMENT_ASSIGNED"}

# --- Integrity flag / appeal policy ---
# A citizen can contest a staff "false report" flag. Once a flag has been
# overturned twice on this case, further flags are not allowed — a case two
# reviewers have judged genuine is not a open question.
MAX_FLAG_APPEALS = 2
FLAG_APPEAL_STATUSES = (None, "PENDING", "APPROVED", "REJECTED")


def grievance_document(
    grievance_id,
    citizen_id,
    title,
    description,
    language="English",
    location=None,
    district=None,
):
    now = datetime.utcnow()

    return {
        "grievance_id": grievance_id,
        "citizen_id": citizen_id,

        "title": title,
        "description": description,
        "translated_text": None,
        "language": language,

        # --- AI classification output ---
        "category": "GENERAL",
        "subcategory": None,
        "severity": "LOW",              # LOW | MEDIUM | HIGH | CRITICAL
        "urgency_score": 0,             # 0-100
        "priority": "LOW",              # LOW | MEDIUM | HIGH | CRITICAL
        "priority_score": 0,            # 0-100
        "confidence": 0.0,              # 0-1 AI confidence
        "needs_authenticity_review": False,  # true when authenticity verdict is not LIKELY_GENUINE
        "authenticity": None,           # staff-only score + explanation (see authenticity_service)
        "content_fingerprint": None,    # staff-only: order-insensitive hash of the report text, used to spot the same wording re-sent from other accounts
        "integrity": None,              # staff-only: trust standing + what friction was applied at submission
        "needs_department_review": False,  # true when confidence < 0.5 at submission
        "ai_reason": None,              # 1-sentence explanation of the AI's department/priority call
        "sentiment": "NEUTRAL",
        "ai_summary": None,
        "recommended_action": None,
        "ai_provider": None,

        # --- duplicate / community intelligence ---
        "duplicate": False,
        "duplicate_score": 0,
        "duplicate_of": None,
        "similar_cases": [],
        "incident_id": None,

        # --- routing ---
        "department": "General Administration",
        "assigned_officer": None,
        "district": district,  # jurisdiction, derived from reverse-geocoded location

        # --- prediction ---
        "predicted_resolution_hours": None,
        "escalation_risk": "LOW",       # LOW | MEDIUM | HIGH
        "sla_due_at": None,

        # --- lifecycle ---
        "status": "SUBMITTED",
        # When the report was confirmed genuine: automatically at submission
        # if screening cleared it, or later by a human in integrity review.
        # Drives the "Verified" stage on the citizen tracking ladder.
        "verified_at": None,
        "history": [
            {
                "status": "SUBMITTED",
                "message": "Grievance submitted by citizen",
                "actor_role": "citizen",
                "visibility": "public",
                "timestamp": now,
            }
        ],

        # --- multimodal input ---
        "attachments": [],
        "voice_transcript": None,
        "location": location,  # GeoJSON Point: {"type": "Point", "coordinates": [lng, lat]}, "address": str

        # --- resolution / verification ---
        "resolution_note": None,
        "resolution_evidence": [],
        "resolved_at": None,
        "citizen_verified": None,       # True / False / None
        "citizen_feedback": None,
        "citizen_rating": None,         # 1-5 satisfaction, given with the verdict
        "citizen_feedback_at": None,
        "reopen_count": 0,

        # --- staff remarks on the case ---
        # PUBLIC remarks are for the citizen, INTERNAL ones are shift notes.
        # Both live on the same array so the audit story of who said what when
        # is one list, and the tracking projection filters by audience.
        "remarks": [],

        # --- rejection (staff: report is not actionable) ---
        "rejection_reason": None,
        "rejected_at": None,
        "rejected_by": None,            # staff-only id
        "rejected_by_name": None,       # staff-only name

        # --- reopening (staff putting a confirmed-and-closed case back in play) ---
        "reopen_reason": None,
        "reopened_at": None,
        "reopened_by": None,            # staff-only id
        "reopened_by_name": None,       # staff-only name

        # --- civic rewards integrity flag ---
        "flagged_invalid": False,       # staff-marked false/misleading (blocks further points)
        "flagged_reason": None,
        "flagged_by": None,
        "flagged_at": None,

        # A flag can be reversed by staff ("we were wrong") or after a citizen
        # appeal is upheld. Both leave a trace, because an account whose flags
        # keep getting overturned should not be scored as a repeat offender.
        "flag_reversed_at": None,
        "flag_reversed_by": None,
        "flag_reversal_note": None,

        # --- citizen appeal against a false-report flag ---
        "flag_appeal_status": None,     # None | PENDING | APPROVED | REJECTED
        "flag_appeal_reason": None,
        "flag_appeal_requested_at": None,
        "flag_appeal_count": 0,         # appeals decided on this case, upheld or not
        "flag_appeal_reviewed_by": None,
        "flag_appeal_reviewed_at": None,
        "flag_appeal_note": None,

        "created_at": now,
        "updated_at": now,
    }