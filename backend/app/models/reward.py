from datetime import datetime


# --- Point values for each lifecycle event -------------------------------
# Deliberately weighted toward verified outcomes (officer acceptance,
# resolution) rather than the act of submitting — see REASON_* below for
# what triggers each one and where in the pipeline it's awarded.
POINTS_VALID_SUBMISSION = 10       # grievance passes AI validation, not a same-citizen duplicate
POINTS_OFFICER_VERIFIED = 20       # an officer accepts / is assigned the case
POINTS_RESOLVED = 30               # citizen confirms the resolution (CLOSED)
POINTS_COMMUNITY_CONFIRM = 5       # an independently-filed report corroborates yours (incident clustering)
POINTS_FIRST_VALID_BONUS = 25      # a citizen's first-ever valid grievance
POINTS_FALSE_REPORT_PENALTY = 15   # deducted when staff flag a report false/misleading

# Reasons — stored on each ledger entry and used as the idempotency key
# (together with citizen_id + grievance_id, or + meta for reasons that
# aren't tied to a single grievance) so nothing is ever double-awarded.
REASON_VALID_SUBMISSION = "VALID_SUBMISSION"
REASON_OFFICER_VERIFIED = "OFFICER_VERIFIED"
REASON_RESOLVED = "RESOLVED"
REASON_COMMUNITY_CONFIRM = "COMMUNITY_CONFIRM"
REASON_FIRST_VALID_BONUS = "FIRST_VALID_BONUS"
REASON_FALSE_REPORT = "FALSE_REPORT_PENALTY"

REASON_LABELS = {
    REASON_VALID_SUBMISSION: "Valid grievance submitted",
    REASON_OFFICER_VERIFIED: "Verified by authority",
    REASON_RESOLVED: "Grievance resolved",
    REASON_COMMUNITY_CONFIRM: "Community confirmed your report",
    REASON_FIRST_VALID_BONUS: "First valid grievance bonus",
    REASON_FALSE_REPORT: "False or misleading report",
}


# --- Tiers — milestones a citizen becomes eligible for as points accrue --
# "NONE" is a placeholder floor tier so compute_tier() always has something
# to return; it's stripped out before being sent to the frontend.
TIERS = [
    {"key": "NONE", "label": "Getting Started", "min_points": 0, "icon": "🌱", "reward": None},
    {"key": "CIVIC_STARTER", "label": "Civic Starter", "min_points": 100, "icon": "🥉", "reward": "Digital Certificate"},
    {"key": "CIVIC_CONTRIBUTOR", "label": "Civic Contributor", "min_points": 250, "icon": "🥈", "reward": "Badge + Certificate"},
    {"key": "CIVIC_CHAMPION", "label": "Civic Champion", "min_points": 500, "icon": "🥇", "reward": "Sponsored Gift / Voucher"},
    {"key": "CIVIC_HERO", "label": "Civic Hero", "min_points": 1000, "icon": "🏆", "reward": "Monthly Prize Eligibility"},
]


def reward_ledger_entry(citizen_id, grievance_id, reason, points, message=None, actor_id=None, meta=None):
    return {
        "citizen_id": citizen_id,
        "grievance_id": grievance_id,
        "reason": reason,
        "label": REASON_LABELS.get(reason, reason),
        "points": points,
        "message": message,
        "actor_id": actor_id,
        "meta": meta or {},
        "created_at": datetime.utcnow(),
    }


def compute_tier(points):
    """Returns (current_tier, next_tier) — next_tier is None once a citizen
    has passed the highest defined tier."""
    current = TIERS[0]
    for tier in TIERS:
        if points >= tier["min_points"]:
            current = tier

    next_tier = None
    for tier in TIERS:
        if tier["min_points"] > points:
            next_tier = tier
            break

    return current, next_tier