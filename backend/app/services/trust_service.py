"""
Citizen trust — how much a reporting account has earned the system's
benefit of the doubt.

The authenticity score (authenticity_service) judges one *report*. This
judges the *account* behind it, using the record the platform already has:
reports that were verified and resolved, reports staff had to flag as false,
withdrawn reports, and self-duplicates. Trust is therefore derived state,
recomputed from real events — never a self-declared attribute — which is
what makes it usable as a fraud signal.

Friction scales with how often a account has been caught out:

  level 0  STANDARD  everything as normal
  level 1  WATCH     low-trust verdicts are always queued for staff review
  level 2  STRICT    daily submission cap, points held until an officer
                     reviews, evidence (photo) expected
  level 3  SEVERE    lower cap, every report is staff-first regardless of
                     what the scorer says

Deliberate limits, and why:
  - Friction never *rejects* a report on content alone. A citizen with a
    genuine problem must always be able to raise it; an over-strict account
    can still submit, it just goes to a human first and earns nothing until
    that human agrees it is real.
  - The only hard stop is a *volume* cap on accounts with multiple
    staff-substantiated false flags, which is a rate limit on abuse rather
    than a judgment on the report.
  - Citizens see appeals and notifications, never their own score — the
    same reasoning as STAFF_ONLY_FIELDS: publishing the formula teaches
    people which signals to dodge.
"""

from datetime import datetime, timedelta

from fastapi import HTTPException

from app.config.settings import settings
from app.config.database import grievances_collection, users_collection


BASELINE_SCORE = 60

LEVEL_STANDARD = 0
LEVEL_WATCH = 1
LEVEL_STRICT = 2
LEVEL_SEVERE = 3

LEVEL_LABELS = {
    LEVEL_STANDARD: "STANDARD",
    LEVEL_WATCH: "WATCH",
    LEVEL_STRICT: "STRICT",
    LEVEL_SEVERE: "SEVERE",
}

# Per-event weights. Caps stop any single axis dominating the score.
POINTS_VERIFIED_RESOLVED = 6
CAP_VERIFIED = 24
POINTS_FLAGGED_FALSE = -18
POINTS_WITHDRAWN = -5
CAP_WITHDRAWN = -15
POINTS_DUPLICATE_SUBMISSION = -4
CAP_DUPLICATES = -12
POINTS_APPEAL_UPHELD = 10
CAP_APPEAL_UPHELD = 20
POINTS_OLD_ACCOUNT = 5
POINTS_CLEAN_RECORD = 8


def _factor(name, impact, detail):
    return {"factor": name, "impact": impact, "detail": detail}


def collect_record(citizen_id):
    """Count the integrity-relevant events on this account. Best-effort: a
    failed lookup yields whatever we already have rather than raising, so a
    trust read can never break grievance submission."""
    now = datetime.utcnow()
    record = {
        "submissions_total": 0,
        "verified_resolved": 0,
        "flagged_false": 0,
        "withdrawn": 0,
        "duplicates": 0,
        "appeals_upheld": 0,
        "account_age_days": None,
        "submissions_today": 0,
    }

    try:
        record["submissions_total"] = grievances_collection.count_documents(
            {"citizen_id": citizen_id}
        )
        record["verified_resolved"] = grievances_collection.count_documents(
            {"citizen_id": citizen_id, "status": "CLOSED", "citizen_verified": True}
        )
        record["flagged_false"] = grievances_collection.count_documents(
            {"citizen_id": citizen_id, "flagged_invalid": True}
        )
        record["withdrawn"] = grievances_collection.count_documents(
            {"citizen_id": citizen_id, "status": "WITHDRAWN"}
        )
        record["duplicates"] = grievances_collection.count_documents(
            {"citizen_id": citizen_id, "duplicate": True}
        )
        record["appeals_upheld"] = grievances_collection.count_documents(
            {"citizen_id": citizen_id, "flag_appeal_status": "APPROVED"}
        )
        record["submissions_today"] = grievances_collection.count_documents(
            {"citizen_id": citizen_id, "created_at": {"$gte": now - timedelta(hours=24)}}
        )
    except Exception as error:  # noqa: BLE001
        print(f"WARNING: trust record lookup failed: {error}")

    try:
        user = users_collection.find_one({"_id": citizen_id}, {"created_at": 1})
        if user and user.get("created_at"):
            record["account_age_days"] = (now - user["created_at"]).days
    except Exception as error:  # noqa: BLE001
        print(f"WARNING: trust account-age lookup failed: {error}")

    return record


def score_from_record(record):
    """Pure, deterministic score + factors — no database access."""
    factors = []
    score = BASELINE_SCORE

    verified = record.get("verified_resolved", 0)
    if verified:
        impact = min(verified * POINTS_VERIFIED_RESOLVED, CAP_VERIFIED)
        score += impact
        factors.append(_factor(
            "verified_resolved", impact,
            f"{verified} report(s) verified by the citizen and closed.",
        ))

    flagged = record.get("flagged_false", 0)
    if flagged:
        impact = flagged * POINTS_FLAGGED_FALSE
        score += impact
        factors.append(_factor(
            "flagged_false", impact,
            f"{flagged} report(s) staff marked false or misleading.",
        ))

    withdrawn = record.get("withdrawn", 0)
    if withdrawn:
        impact = max(withdrawn * POINTS_WITHDRAWN, CAP_WITHDRAWN)
        score += impact
        factors.append(_factor(
            "withdrawn", impact,
            f"{withdrawn} report(s) withdrawn by the account itself.",
        ))

    duplicates = record.get("duplicates", 0)
    if duplicates:
        impact = max(duplicates * POINTS_DUPLICATE_SUBMISSION, CAP_DUPLICATES)
        score += impact
        factors.append(_factor(
            "duplicate_reports", impact,
            f"{duplicates} report(s) were repeats of the account's own earlier report.",
        ))

    upheld = record.get("appeals_upheld", 0)
    if upheld:
        impact = min(upheld * POINTS_APPEAL_UPHELD, CAP_APPEAL_UPHELD)
        score += impact
        factors.append(_factor(
            "appeals_upheld", impact,
            f"{upheld} flag(s) overturned on appeal — the account was right.",
        ))

    age_days = record.get("account_age_days")
    if age_days is not None and age_days >= 90:
        score += POINTS_OLD_ACCOUNT
        factors.append(_factor(
            "established_account", POINTS_OLD_ACCOUNT,
            f"Account is {age_days} days old.",
        ))

    flagged = record.get("flagged_false", 0)
    verified = record.get("verified_resolved", 0)
    if flagged == 0 and verified >= 2:
        score += POINTS_CLEAN_RECORD
        factors.append(_factor(
            "clean_record", POINTS_CLEAN_RECORD,
            "Never flagged false, with multiple confirmed resolutions.",
        ))

    return max(0, min(100, round(score, 1))), factors


def level_from(record, score):
    """Level is driven by *adjudicated events*, not by the score.

    That ordering matters: the score is a graded summary that includes soft
    things (withdrawals, duplicate filings, account age), and using it as the
    gate would cap an account that has never been caught doing anything wrong
    just because it files awkwardly. Flags are facts — a staff member already
    looked and decided — so they set the floor. The score only contributes a
    one-way downgrade, and only when it is genuinely poor with nothing in the
    account's favour.

    Note the baseline: a brand new account scores exactly BASELINE_SCORE and
    must land on STANDARD. Raising the bands above 60 would put every new
    citizen on a watch list on day one, which is both wrong and self-fulfilling."""
    flagged = record.get("flagged_false", 0)
    verified = record.get("verified_resolved", 0)

    if flagged >= settings.TRUST_SEVERE_FLAG_THRESHOLD:
        return LEVEL_SEVERE
    if flagged >= settings.TRUST_STRICT_FLAG_THRESHOLD:
        return LEVEL_STRICT
    if flagged >= 1:
        return LEVEL_WATCH

    # No substantiated flags, but a thin record: repeated self-withdrawals
    # and duplicate filings drag the score down with nothing offsetting them.
    if score < 45 and verified == 0:
        return LEVEL_WATCH

    return LEVEL_STANDARD


def compute_trust(citizen_id, persist=True):
    """Entry point. Returns the trust dict stored on the grievance/user doc."""
    record = collect_record(citizen_id)
    score, factors = score_from_record(record)
    level = level_from(record, score)

    trust = {
        "score": score,
        "level": level,
        "label": LEVEL_LABELS[level],
        "factors": sorted(factors, key=lambda f: f["impact"]),
        "record": {
            "submissions_total": record.get("submissions_total", 0),
            "submissions_today": record.get("submissions_today", 0),
            "verified_resolved": record.get("verified_resolved", 0),
            "flagged_false": record.get("flagged_false", 0),
            "withdrawn": record.get("withdrawn", 0),
            "duplicates": record.get("duplicates", 0),
            "appeals_upheld": record.get("appeals_upheld", 0),
        },
        "computed_at": datetime.utcnow(),
    }

    if persist and citizen_id:
        try:
            users_collection.update_one(
                {"_id": citizen_id},
                {"$set": {"trust": trust, "trust_updated_at": trust["computed_at"]}},
            )
        except Exception as error:  # noqa: BLE001
            print(f"WARNING: could not persist trust: {error}")

    return trust


def refresh_trust(citizen_id):
    """Called after any integrity-relevant event (flag, unflag, appeal
    outcome, verification, withdrawal) so the stored score reflects the
    account's current record rather than the one at submission time."""
    return compute_trust(citizen_id, persist=True)


def daily_cap_for(level):
    if level >= LEVEL_SEVERE:
        return settings.TRUST_DAILY_CAP_SEVERE
    if level >= LEVEL_STRICT:
        return settings.TRUST_DAILY_CAP_STRICT
    return None


def enforce_volume_cap(trust, already_submitted_today):
    """The only hard stop in the integrity stack, and it is a rate limit on
    an account with a substantiated history of false reports — not a
    judgment on the content of the new report. Raises 429 with a plain
    explanation so the citizen knows to try again tomorrow."""
    cap = daily_cap_for(trust.get("level", LEVEL_STANDARD))
    if cap is None:
        return

    if already_submitted_today >= cap:
        raise HTTPException(
            status_code=429,
            detail=(
                "This account has had earlier reports marked false by staff, so "
                f"it is limited to {cap} report(s) per day. Your issue still "
                "matters — please submit again tomorrow, or contact your ward "
                "office if it is urgent."
            ),
        )


def submission_friction(trust, authenticity):
    """What this specific submission inherits from the account's standing.
    Consumed by create_grievance(); nothing here rejects the report."""
    level = trust.get("level", LEVEL_STANDARD)
    verdict = (authenticity or {}).get("verdict")

    friction = {
        "level": level,
        "label": LEVEL_LABELS.get(level, "STANDARD"),
        "hold_points": False,
        "staff_first": False,
        "evidence_expected": level >= LEVEL_STRICT,
        "reason": None,
    }

    if level >= LEVEL_STRICT:
        # Low-standing account + a report the scorer is unsure about: an
        # officer decides first, points later. Ordinary, confident reports
        # from these accounts still flow normally.
        if verdict and verdict != "LIKELY_GENUINE":
            friction["hold_points"] = True
            friction["staff_first"] = True
            friction["reason"] = (
                f"Account trust is {trust.get('score')} ({friction['label']}) and the report "
                "scored as "
                f"{verdict.replace('_', ' ').lower()} — an officer reviews before any points."
            )

    return friction
