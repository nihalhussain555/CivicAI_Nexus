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
)


def _already_awarded(citizen_id, grievance_id, reason, meta_key=None, meta_value=None):
    """Idempotency guard. One award per (citizen, grievance, reason) for
    grievance-scoped reasons, or per (citizen, reason, meta[meta_key]) for
    reasons — like community confirmation — that key off something other
    than a single grievance (an incident, here)."""
    query = {"citizen_id": citizen_id, "reason": reason}
    if meta_key is not None:
        query[f"meta.{meta_key}"] = meta_value
    else:
        query["grievance_id"] = grievance_id
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


def award_officer_verified(citizen_id, grievance_id):
    """+20 the first time a grievance is accepted / assigned to an officer —
    an authority has looked at it and treated it as real and actionable."""
    if _already_awarded(citizen_id, grievance_id, REASON_OFFICER_VERIFIED):
        return
    _insert(citizen_id, grievance_id, REASON_OFFICER_VERIFIED, POINTS_OFFICER_VERIFIED)


def award_resolved(citizen_id, grievance_id):
    """+30 once, when the citizen confirms the resolution (status -> CLOSED)."""
    if _already_awarded(citizen_id, grievance_id, REASON_RESOLVED):
        return
    _insert(citizen_id, grievance_id, REASON_RESOLVED, POINTS_RESOLVED)


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