from app.config.database import reward_ledger_collection, users_collection
from app.models.reward import (
    reward_ledger_entry,
    compute_tier,
    TIERS,
    POINTS_VALID_SUBMISSION,
    POINTS_OFFICER_VERIFIED,
    POINTS_RESOLVED,
    POINTS_COMMUNITY_CONFIRM,
    POINTS_FIRST_VALID_BONUS,
    POINTS_FALSE_REPORT_PENALTY,
    REASON_VALID_SUBMISSION,
    REASON_OFFICER_VERIFIED,
    REASON_RESOLVED,
    REASON_COMMUNITY_CONFIRM,
    REASON_FIRST_VALID_BONUS,
    REASON_FALSE_REPORT,
    REASON_REOPENED_REVERSAL,
)


def _already_awarded(citizen_id, grievance_id, reason, meta_key=None, meta_value=None):
    """Idempotency guard. Always scoped to (citizen, grievance, reason);
    grievance_id is None for reasons — like community confirmation — that
    key off something other than a single grievance (an incident, here).
    meta_key/meta_value adds a further constraint, e.g. scoping officer-
    verified/resolved awards to a specific reopen cycle so a *legitimate*
    re-resolution after an approved reopen can still earn points, while
    still blocking the same cycle from being paid twice."""
    query = {"citizen_id": citizen_id, "reason": reason, "grievance_id": grievance_id}
    if meta_key is not None:
        query[f"meta.{meta_key}"] = meta_value
    return reward_ledger_collection.find_one(query) is not None


def _insert(citizen_id, grievance_id, reason, points, message=None, actor_id=None, meta=None):
    entry = reward_ledger_entry(citizen_id, grievance_id, reason, points, message, actor_id, meta)
    reward_ledger_collection.insert_one(entry)
    return entry


def award_valid_submission(grievance):
    """+10 once the AI pipeline has classified the grievance as genuine —
    i.e. not flagged as a same-citizen duplicate. Also grants the one-time
    +25 first-valid bonus the first time a citizen ever earns this reason.
    Duplicates simply never reach this path with points attached — the
    caller (create_grievance) still calls this, but it's a no-op for them.
    """
    citizen_id = grievance["citizen_id"]
    grievance_id = grievance["grievance_id"]

    if grievance.get("duplicate"):
        return

    if _already_awarded(citizen_id, grievance_id, REASON_VALID_SUBMISSION):
        return

    _insert(citizen_id, grievance_id, REASON_VALID_SUBMISSION, POINTS_VALID_SUBMISSION)

    is_first_ever = reward_ledger_collection.count_documents(
        {"citizen_id": citizen_id, "reason": REASON_VALID_SUBMISSION}
    ) == 1

    if is_first_ever:
        _insert(citizen_id, grievance_id, REASON_FIRST_VALID_BONUS, POINTS_FIRST_VALID_BONUS)


def award_officer_verified(citizen_id, grievance_id, cycle=0):
    """+20 the first time, per reopen cycle, that a grievance is accepted
    or assigned to an officer — an authority has looked at it and treated
    it as real and actionable. Cycle-scoped so a legitimate reopen-and-
    reassign still pays out once the case is genuinely looked at again."""
    if _already_awarded(citizen_id, grievance_id, REASON_OFFICER_VERIFIED, meta_key="cycle", meta_value=cycle):
        return
    _insert(citizen_id, grievance_id, REASON_OFFICER_VERIFIED, POINTS_OFFICER_VERIFIED, meta={"cycle": cycle})


def award_resolved(citizen_id, grievance_id, cycle=0):
    """+30 once per reopen cycle, when the citizen confirms the resolution
    (status -> CLOSED). Cycle-scoped for the same reason as above — see
    reverse_resolution_points for what happens if that cycle's resolution
    later turns out to have been premature."""
    if _already_awarded(citizen_id, grievance_id, REASON_RESOLVED, meta_key="cycle", meta_value=cycle):
        return
    _insert(citizen_id, grievance_id, REASON_RESOLVED, POINTS_RESOLVED, meta={"cycle": cycle})


def award_community_confirmations(incident, citizen_ids):
    """+5 to each distinct citizen behind an incident, once per citizen per
    incident. Gated entirely by the existing geo + category clustering in
    incident_service — a citizen can't trigger this by resubmitting the
    same complaint, only by a *different* citizen's independent report
    landing in the same cluster. Symmetric: whichever citizen just joined
    the cluster and whichever citizens were already in it all qualify,
    but each only ever once for a given incident."""
    if len(citizen_ids) < 2:
        return

    incident_id = incident["incident_id"]

    for citizen_id in citizen_ids:
        if _already_awarded(
            citizen_id, None, REASON_COMMUNITY_CONFIRM,
            meta_key="incident_id", meta_value=incident_id,
        ):
            continue

        _insert(
            citizen_id, None, REASON_COMMUNITY_CONFIRM, POINTS_COMMUNITY_CONFIRM,
            message=f"Your report was corroborated by other citizens in the same area (incident {incident_id}).",
            meta={"incident_id": incident_id},
        )


def flag_false_report(grievance, actor):
    """Staff mark a grievance false or misleading — deducts points once.
    Idempotent: flagging twice never deducts twice."""
    citizen_id = grievance["citizen_id"]
    grievance_id = grievance["grievance_id"]

    if _already_awarded(citizen_id, grievance_id, REASON_FALSE_REPORT):
        return None

    return _insert(
        citizen_id, grievance_id, REASON_FALSE_REPORT, -POINTS_FALSE_REPORT_PENALTY,
        actor_id=actor["_id"],
    )


def reverse_resolution_points(grievance):
    """Claws back the +30 'resolved' points for the current reopen cycle
    (and only those — submission and officer-verification points stand,
    since the report itself was still real) when an approved reopen
    request shows the case wasn't actually fixed. Cycle-scoped so that if
    the case is resolved and reopened more than once, each cycle's award
    is reversed independently rather than only ever the first. Idempotent
    per cycle, and a no-op if that cycle's resolved award was never made."""
    citizen_id = grievance["citizen_id"]
    grievance_id = grievance["grievance_id"]
    cycle = grievance.get("reopen_count", 0)

    already_resolved_award = reward_ledger_collection.find_one({
        "citizen_id": citizen_id,
        "grievance_id": grievance_id,
        "reason": REASON_RESOLVED,
        "meta.cycle": cycle,
    })
    if not already_resolved_award:
        return None

    if _already_awarded(citizen_id, grievance_id, REASON_REOPENED_REVERSAL, meta_key="cycle", meta_value=cycle):
        return None

    return _insert(
        citizen_id, grievance_id, REASON_REOPENED_REVERSAL, -POINTS_RESOLVED,
        message="Case was reopened after being marked resolved — resolution points reversed.",
        meta={"cycle": cycle},
    )


def get_total_points(citizen_id):
    pipeline = [
        {"$match": {"citizen_id": citizen_id}},
        {"$group": {"_id": None, "total": {"$sum": "$points"}}},
    ]
    result = list(reward_ledger_collection.aggregate(pipeline))
    return max(0, result[0]["total"]) if result else 0


def get_citizen_summary(citizen_id, ledger_limit=25):
    total = get_total_points(citizen_id)
    tier, next_tier = compute_tier(total)

    ledger = list(
        reward_ledger_collection.find({"citizen_id": citizen_id})
        .sort("created_at", -1)
        .limit(ledger_limit)
    )

    points_to_next = (next_tier["min_points"] - total) if next_tier else 0

    return {
        "total_points": total,
        "tier": tier,
        "next_tier": next_tier,
        "points_to_next_tier": max(0, points_to_next),
        "ledger": ledger,
        "all_tiers": TIERS[1:],  # drop the internal "NONE" floor tier
    }


def get_leaderboard(limit=10):
    pipeline = [
        {"$group": {"_id": "$citizen_id", "total": {"$sum": "$points"}}},
        {"$match": {"total": {"$gt": 0}}},
        {"$sort": {"total": -1}},
        {"$limit": limit},
    ]
    rows = list(reward_ledger_collection.aggregate(pipeline))

    leaderboard = []
    for rank, row in enumerate(rows, start=1):
        user = users_collection.find_one({"_id": row["_id"]}, {"name": 1})
        tier, _ = compute_tier(row["total"])
        leaderboard.append({
            "rank": rank,
            "citizen_id": row["_id"],
            "name": (user.get("name") if user else None) or "Citizen",
            "points": row["total"],
            "tier": tier,
        })

    return leaderboard