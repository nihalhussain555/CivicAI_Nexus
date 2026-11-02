"""Fake-grievance detection.

These cover the scoring engine itself — the pure functions, no database and no
email — because the weights, bands and fusion caps are the parts most likely to
be broken by an edit and least visible when they are: a detector that quietly
stops queueing campaigns still returns 200s everywhere.
"""

from app.services.authenticity_service import (
    GENUINE_THRESHOLD,
    LIKELY_FAKE,
    LIKELY_GENUINE,
    NEEDS_REVIEW,
    REVIEW_THRESHOLD,
    REVIEW_SIGNAL_FLOOR,
    content_fingerprint,
    evaluate_authenticity,
)
from app.services.trust_service import (
    BASELINE_SCORE,
    LEVEL_SEVERE,
    LEVEL_STANDARD,
    LEVEL_STRICT,
    LEVEL_WATCH,
    level_from,
    submission_friction,
)

CLEAN_TEXT = (
    "Stormwater drain at Besant Nagar Beach Road has been overflowing for three "
    "weeks and the smell is unbearable for the shop owners nearby."
)
LOCATION = {"type": "Point", "coordinates": [80.2707, 13.0827], "address": "Besant Nagar Beach Road"}

GOOD_ATTACHMENT = [{"url": "/uploads/drain.jpg", "signature": "aaaa" * 8}]
REUSED_ATTACHMENT = [{"url": "/uploads/other.jpg", "signature": "bbbb" * 8}]


def _signals(result):
    return {s["signal"]: s["impact"] for s in result["signals"]}


def score(text=CLEAN_TEXT, **kwargs):
    return evaluate_authenticity(text, location=kwargs.pop("location", LOCATION),
                                 address=LOCATION["address"], district="Chennai", **kwargs)


def test_clean_report_with_photo_clears_the_bar():
    result = score(attachments=GOOD_ATTACHMENT)
    assert result["verdict"] == LIKELY_GENUINE
    assert result["queue_for_review"] is False
    assert result["score"] > GENUINE_THRESHOLD


def test_gibberish_without_location_is_likely_fake():
    result = evaluate_authenticity("asdf qwer zxcv nb nh mh vkh")
    signals = _signals(result)
    assert result["verdict"] == LIKELY_FAKE
    assert "keyboard_mashing" in signals
    assert "no_coordinates" in signals


def test_placeholder_coordinates_are_the_worst_location_signal():
    null_island = {"type": "Point", "coordinates": [0.0, 0.0], "address": "Somewhere Street"}
    outside = {"type": "Point", "coordinates": [2.34, 4.56], "address": "Somewhere Street"}
    assert _signals(score(location=null_island))["null_island"] < \
        _signals(score(location=outside))["outside_service_area"]


def test_spam_link_is_penalised():
    result = score("CLAIM YOUR FREE GOVERNMENT PRIZE MONEY NOW AT https://example.win CLICK HERE")
    assert "spam_markers" in _signals(result)


def test_urgent_report_with_no_anchor_is_questioned():
    result = score(
        "something very dangerous is happening please come immediately",
        ai={"priority": "CRITICAL"},
    )
    assert "severe_but_vague" in _signals(result)


def test_urgent_report_naming_a_place_is_not_questioned():
    # The rule is about unactionable reports, not alarming ones: an officer can
    # dispatch this without phoning anybody first.
    result = score(
        "There is a live wire hanging over the Anna Nagar 4th Avenue gate since this morning.",
        ai={"priority": "CRITICAL"},
    )
    assert "severe_but_vague" not in _signals(result)


def _reuse_context(spans_scope):
    return {"evidence_reuse": {
        "matches": 1, "other_citizens": 1, "foreign_matches": 1,
        "own_matches": 0, "spans_scope": spans_scope,
        "scope_note": "different category or area" if spans_scope else "same area and category",
    }}


def test_photo_recycled_for_a_different_problem_is_a_hard_signal():
    result = score(attachments=REUSED_ATTACHMENT, context=_reuse_context(True))
    assert _signals(result)["recycled_evidence"] <= REVIEW_SIGNAL_FLOOR
    # Same wording, same photo, same kind of issue nearby: one real incident
    # photographed once and forwarded around. Caution, not accusation.
    soft = score(attachments=REUSED_ATTACHMENT, context=_reuse_context(False))
    assert _signals(soft)["shared_evidence"] > REVIEW_SIGNAL_FLOOR


def test_one_disqualifying_signal_queues_regardless_of_the_total():
    # 70 + detailed + landmark + duration + photo - recycled = a passing score
    # that a human still has to see, or photo reuse would never reach the queue.
    result = score(attachments=REUSED_ATTACHMENT, context=_reuse_context(True))
    assert result["verdict"] == LIKELY_GENUINE
    assert result["queue_for_review"] is True


def _campaign(districts, distinct_citizens=2):
    return {"campaign": {
        "matches": distinct_citizens, "distinct_citizens": distinct_citizens,
        "districts": districts, "categories": ["WATER"],
    }}


def test_identical_wording_from_two_districts_reads_as_a_campaign():
    # The report's own district counts towards the spread even though the twins
    # it collides with are all in one other district.
    result = evaluate_authenticity(
        "Open a complaint against the corporation for not paying the agreed amount",
        district="Coimbatore", context=_campaign(["Chennai"]),
    )
    assert "coordinated_campaign" in _signals(result)


def test_identical_wording_inside_one_district_is_only_a_caution():
    result = evaluate_authenticity(
        "Open a complaint against the corporation for not paying the agreed amount",
        district="Chennai", context=_campaign(["Chennai"]),
    )
    signals = _signals(result)
    assert "coordinated_campaign" not in signals
    assert signals["templated_text"] > REVIEW_SIGNAL_FLOOR


def test_two_accounts_are_not_yet_a_ring():
    result = evaluate_authenticity(
        "Open a complaint against the corporation for not paying the agreed amount",
        district="Chennai", context=_campaign(["Coimbatore"], distinct_citizens=1),
    )
    assert not {"coordinated_campaign", "templated_text"} & set(_signals(result))


def test_burst_of_submissions_from_one_account_is_penalised():
    burst = score(context={"submissions_last_hour": 6, "submissions_last_24h": 12})
    assert "submission_burst" in _signals(burst)
    # The daily volume check is the fallback for someone who paces themselves
    # rather than spamming one minute — it should not fire on top of a burst.
    paced = score(context={"submissions_last_hour": 1, "submissions_last_24h": 12})
    assert "high_daily_volume" in _signals(paced)
    assert "submission_burst" not in _signals(paced)


def test_low_trust_account_carries_forward_onto_new_reports():
    trust = {"score": 30, "level": LEVEL_STRICT, "label": "STRICT",
             "record": {"flagged_false": 2, "verified_resolved": 0}}
    result = score(context={"trust": trust})
    assert "low_trust_account" in _signals(result)


def test_the_llm_is_never_the_only_reason_a_report_is_cleared():
    gibberish = evaluate_authenticity("asdf qwer zxcv nb nh mh vkh")
    fused = evaluate_authenticity(
        "asdf qwer zxcv nb nh mh vkh",
        ai_read={"score": 95, "verdict": LIKELY_GENUINE},
    )
    assert gibberish["verdict"] == LIKELY_FAKE
    assert fused["verdict"] != LIKELY_GENUINE
    assert fused["score"] < GENUINE_THRESHOLD


def test_the_llm_is_never_the_only_reason_a_report_is_called_fake():
    result = score(attachments=GOOD_ATTACHMENT, ai_read={"score": 0, "verdict": LIKELY_FAKE})
    assert result["verdict"] != LIKELY_FAKE
    assert result["score"] >= REVIEW_THRESHOLD
    # Two estimators this far apart is itself worth a human's time.
    assert result["estimator_disagreement"] is True


def test_without_an_ai_read_the_rules_alone_decide():
    assert score()["basis"] == "rules"
    assert score(ai_read={"score": 70, "verdict": LIKELY_GENUINE})["basis"] == "rules+ai"


def test_fingerprint_survives_reordering_and_punctuation():
    a = content_fingerprint("garbage overflowing bin street collection missed week")
    b = content_fingerprint("Missed week, street bin collection: garbage overflowing!")
    assert a and a == b
    assert content_fingerprint("garbage overflowing bin street collection missed month") != a


def test_fingerprint_needs_enough_text_to_mean_anything():
    assert content_fingerprint("test test") is None


def test_trust_level_follows_adjudicated_flags_not_the_score():
    empty = {"flagged_false": 0, "verified_resolved": 0}
    assert level_from(empty, BASELINE_SCORE) == LEVEL_STANDARD
    assert level_from({"flagged_false": 1}, 50) == LEVEL_WATCH
    assert level_from({"flagged_false": 2}, 50) == LEVEL_STRICT
    assert level_from({"flagged_false": 4}, 50) == LEVEL_SEVERE
    # No flag has ever been upheld against this account, but it withdraws and
    # duplicates everything it files: still worth watching, never capped.
    assert level_from(empty, 40) == LEVEL_WATCH


def test_friction_holds_points_only_for_a_shaky_account_and_a_shaky_report():
    strict = {"score": 30, "level": LEVEL_STRICT, "label": "STRICT", "record": {"flagged_false": 2}}
    held = submission_friction(strict, {"verdict": NEEDS_REVIEW})
    assert held["hold_points"] is True and held["staff_first"] is True
    assert held["evidence_expected"] is True

    # Same account, confident report: it flows normally and earns normally.
    clear = submission_friction(strict, {"verdict": LIKELY_GENUINE})
    assert clear["hold_points"] is False and clear["staff_first"] is False

    healthy = {"score": 80, "level": LEVEL_STANDARD, "label": "STANDARD", "record": {}}
    assert submission_friction(healthy, {"verdict": NEEDS_REVIEW})["hold_points"] is False
