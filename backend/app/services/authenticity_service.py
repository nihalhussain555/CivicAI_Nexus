"""
Grievance authenticity check — "is this complaint likely real?", separate
from duplicate detection (which only asks "have we seen this one before?").

There is no single reliable test for a fake complaint, so this combines
several weak signals into an explainable 0-100 credibility score:

  1. Text quality     — gibberish, keyboard-mashing, test/spam phrases
  2. Specificity      — concrete detail (landmarks, numbers, duration)
  3. Location         — coordinates plausible for the service area
  4. Evidence         — attached photos, and whether a photo is recycled
  5. Account behavior — submission bursts, past flagged reports, track record
  6. Corroboration    — other citizens reporting the same thing nearby
  7. Collusion        — the same wording arriving from many unrelated accounts
  8. Trust            — what this account's own record says about it
  9. AI substance     — an independent read of whether the described problem
                        could plausibly have happened at all

The result is a triage aid, NOT a verdict: it never rejects a complaint.
Low scores route the case to a human (staff see the breakdown; citizens
never do, so the rules can't be reverse-engineered and gamed).

Two ideas hold the design together:

  - Signals are correlated but individually weak, so they add up rather than
    veto. Any single signal ("new account", "no photo") also describes plenty
    of genuine reporters, which is why nothing here can reject on its own.
  - The AI read is a *second estimator*, not a copy of the rules. It can move
    the score and pull a confident rule-pass down into the review band, but it
    is never the sole reason a report is called fake, and never the sole
    reason one is cleared. Both caps are enforced in _fuse_with_ai().
"""

import hashlib
import os
import re
import unicodedata
from datetime import datetime, timedelta

from app.config.settings import settings

# Generous box around Tamil Nadu + a margin for border districts.
VALID_LAT_RANGE = (7.8, 13.9)
VALID_LON_RANGE = (75.8, 80.9)

LIKELY_GENUINE = "LIKELY_GENUINE"
NEEDS_REVIEW = "NEEDS_REVIEW"
LIKELY_FAKE = "LIKELY_FAKE"

GENUINE_THRESHOLD = 65
REVIEW_THRESHOLD = 40

BASE_SCORE = 70

# Matching wording from accounts in more than this many districts is the
# tell: one neighbourhood forwarding one real problem stays local, a
# broadcast fake-reporting campaign sprays the same body everywhere.
COLLUSION_MIN_DISTRICTS = 2

TEST_PHRASES = {
    "test", "testing", "test test", "asdf", "asdfgh", "qwerty", "abc", "abcd",
    "hello", "hi", "hii", "lorem ipsum", "xyz", "demo", "sample", "check",
}
KEYBOARD_MASH = ("asdf", "qwer", "zxcv", "hjkl", "sdfg", "dfgh", "wert", "erty", "uiop")
SPAM_MARKERS = ("http://", "https://", "www.", "whatsapp", "buy now", "click here", "free money", "lottery")

LANDMARK_WORDS = (
    "near", "opposite", "behind", "road", "street", "nagar", "colony", "junction",
    "bus stop", "school", "temple", "market", "hospital", "signal", "ward",
    "தெரு", "சாலை", "அருகில்", "பேருந்து", "நகர்",
    "सड़क", "गली", "पास", "चौराहा", "बस स्टॉप", "मोहल्ला",
    "റോഡ്", "സമീപം", "ജംഗ്ഷൻ", "ബസ് സ്റ്റോപ്പ്",
)
DURATION_WORDS = (
    "since", "days", "day", "week", "weeks", "month", "yesterday", "morning", "night", "hours",
    "நாட்கள", "வாரம", "நேற்று", "நாள்",
    "दिन", "हफ्ते", "कल", "सुबह",
    "ദിവസം", "ആഴ്ച", "ഇന്നലെ",
)


def _is_letter(ch):
    # Indic scripts use combining vowel signs (category M*) that str.isalpha()
    # rejects — without this, genuine Tamil/Hindi/Malayalam text would score
    # as "mostly symbols" and be wrongly penalised.
    return ch.isalpha() or unicodedata.category(ch).startswith("M")


def _signal(name, impact, detail):
    return {"signal": name, "impact": impact, "detail": detail}


# --- fingerprinting helpers -------------------------------------------------

_FINGERPRINT_STOPWORDS = {
    "the", "and", "for", "with", "this", "that", "have", "has", "are", "was",
    "were", "our", "your", "near", "not", "but", "you", "from", "there", "is",
    "of", "in", "to", "a", "s", "please", "kindly", "sir", "madam",
}


def content_fingerprint(text):
    """Stable key for 'the same report, re-sent'.

    Sorted-set hashing (rather than a hash of the raw string) means a
    campaign that shuffles word order, swaps punctuation, or varies the
    greeting still collides. Coordinates and street names are deliberately
    excluded — a broadcast template keeps its body while only the address
    line changes, and the address is the part they have to vary.

    Trade-off worth knowing: sorting the token set loses word order, so two
    genuinely different complaints that happen to use the same vocabulary
    could collide. With a minimum token count and real civic text being
    large and varied, that is rare; and a collision only *asks a human to
    look*, which is the same consequence as any other signal.
    """
    tokens = [
        t for t in re.sub(r"[^a-z0-9\u0900-\u097F\u0B80-\u0BFF\u0D00-\u0D7F\s]", " ",
                           (text or "").lower()).split()
        if len(t) > 2 and t not in _FINGERPRINT_STOPWORDS
    ]
    if len(tokens) < 3:
        return None

    digest = hashlib.sha256(" ".join(sorted(set(tokens))).encode("utf-8")).hexdigest()
    return digest[:32]


def file_signature(url):
    """SHA-256 of an uploaded file's bytes, so an identical photo re-submitted
    for a different problem is detectable. Computed server-side from the stored
    file rather than trusted from the client — a client that wanted to dodge the
    check would simply send a wrong hash.

    Exact-content, not perceptual: it catches the common case (the same JPEG
    forwarded and re-uploaded) and needs no image dependency. A crop, edit or
    re-encode of the same photo is *not* caught; perceptual hashing is the
    documented upgrade path."""
    if not url:
        return None

    # Only ever resolve within the upload dir — the URL comes from stored
    # attachment data, which originated from a client-supplied path.
    name = os.path.basename(str(url))
    if not name:
        return None

    path = os.path.join(settings.UPLOAD_DIR, name)
    try:
        with open(path, "rb") as handle:
            return hashlib.sha256(handle.read()).hexdigest()[:32]
    except OSError:
        return None


def sign_attachments(attachments):
    """Annotate the attachment list in place with content signatures and
    return it, so reuse can be queried later without re-reading files."""
    signed = []
    for item in attachments or []:
        attachment = dict(item)
        signature = file_signature(attachment.get("url"))
        if signature:
            attachment["signature"] = signature
        signed.append(attachment)
    return signed


def _text_quality_signals(text):
    signals = []
    stripped = text.strip()
    lowered = stripped.lower()
    words = stripped.split()
    non_space = [c for c in stripped if not c.isspace()]

    if lowered in TEST_PHRASES:
        signals.append(_signal("test_phrase", -35, f'Text is just "{lowered}" — looks like a test entry.'))
        return signals

    if non_space:
        letter_ratio = sum(1 for c in non_space if _is_letter(c)) / len(non_space)
        if letter_ratio < 0.5:
            signals.append(_signal("mostly_symbols", -25, f"Only {round(letter_ratio * 100)}% of the text is letters."))

    if len(words) < 4:
        signals.append(_signal("very_short", -15, f"Only {len(words)} word(s) — too little to act on."))

    if re.search(r"(.)\1{4,}", stripped):
        signals.append(_signal("repeated_characters", -15, "Contains long runs of the same character."))

    ascii_words = [w for w in re.findall(r"[A-Za-z]{4,}", stripped)]
    if any(m in lowered for m in KEYBOARD_MASH):
        signals.append(_signal("keyboard_mashing", -25, "Contains keyboard-mash patterns (e.g. asdf, qwer)."))
    elif ascii_words:
        vowelless = [w for w in ascii_words if len(w) >= 6 and not re.search(r"[aeiouyAEIOUY]", w)]
        if vowelless:
            signals.append(_signal("vowelless_words", -20, "Contains long words with no vowels (likely random typing)."))

    if len(words) >= 6:
        unique_ratio = len({w.lower() for w in words}) / len(words)
        if unique_ratio < 0.4:
            signals.append(_signal("repetitive_text", -15, "Same few words repeated over and over."))

    latin_letters = [c for c in stripped if c.isascii() and c.isalpha()]
    if len(latin_letters) > 20 and sum(1 for c in latin_letters if c.isupper()) / len(latin_letters) > 0.85:
        signals.append(_signal("all_caps", -5, "Written entirely in capitals."))

    if any(marker in lowered for marker in SPAM_MARKERS):
        signals.append(_signal("spam_markers", -20, "Contains links or promotional wording."))

    return signals


def _specificity_signals(text):
    signals = []
    lowered = text.lower()

    if len(text.strip()) >= 40:
        signals.append(_signal("detailed", 8, "Reasonably detailed description."))

    if any(w in lowered for w in LANDMARK_WORDS):
        signals.append(_signal("landmark_mentioned", 7, "Mentions a street/landmark/place."))

    if re.search(r"\d", text) or any(w in lowered for w in DURATION_WORDS):
        signals.append(_signal("duration_or_number", 5, "Gives a duration or specific number."))

    return signals


def _location_signals(location, address):
    signals = []
    coords = (location or {}).get("coordinates")

    if not coords or len(coords) != 2:
        signals.append(_signal("no_coordinates", -20, "No usable GPS coordinates."))
        return signals

    lon, lat = coords

    if lat == 0 and lon == 0:
        signals.append(_signal("null_island", -40, "Coordinates are exactly (0, 0) — a placeholder, not a real place."))
    elif not (VALID_LAT_RANGE[0] <= lat <= VALID_LAT_RANGE[1] and VALID_LON_RANGE[0] <= lon <= VALID_LON_RANGE[1]):
        signals.append(_signal("outside_service_area", -30, "GPS location is outside the service area."))

    if not (address or "").strip():
        signals.append(_signal("no_address", -5, "No address text with the location."))

    return signals


def _evidence_signals(attachments, ctx=None):
    ctx = ctx or {}
    signals = []

    if attachments:
        signals.append(_signal(
            "photo_attached", 10,
            f"{len(attachments)} photo(s) attached as evidence.",
        ))

    # A photo that has already been submitted on other cases proves the
    # picture is real but says nothing about *this* location or *this*
    # problem — which is exactly how recycled-evidence fakes work.
    reuse = ctx.get("evidence_reuse") or {}
    others = reuse.get("other_citizens", 0)
    total = reuse.get("matches", 0)

    if others and reuse.get("spans_scope"):
        signals.append(_signal(
            "recycled_evidence", -28,
            f"The same photo appears on {total} other report(s) from {others} "
            f"other account(s), for a different {reuse.get('scope_note')}.",
        ))
    elif others:
        signals.append(_signal(
            "shared_evidence", -8,
            f"The same photo was also submitted by {others} other account(s) "
            "for the same kind of issue in the same area — probably one real "
            "problem, one forwarded photo.",
        ))
    elif total:
        signals.append(_signal(
            "reused_own_photo", -12,
            f"This account has already submitted the same photo on {total} "
            "earlier report(s) of a different issue.",
        ))

    return signals


def _behavior_signals(ctx):
    signals = []

    age_hours = ctx.get("account_age_hours")
    if age_hours is not None:
        if age_hours < 1:
            signals.append(_signal("brand_new_account", -10, "Account is less than an hour old."))
        elif age_hours < 24:
            signals.append(_signal("new_account", -5, "Account is less than a day old."))

    if ctx.get("submissions_last_hour", 0) >= 5:
        signals.append(_signal("submission_burst", -25, f"{ctx['submissions_last_hour']} grievances from this account in the last hour."))
    elif ctx.get("submissions_last_24h", 0) >= 10:
        signals.append(_signal("high_daily_volume", -15, f"{ctx['submissions_last_24h']} grievances from this account in 24 hours."))

    # Deliberately silent about past flags and past resolutions: what this
    # account has *proven* is _trust_signals' job. Emitting it from both places
    # double-counts one fact and makes the weight look like -23 for a single
    # earlier flag. Velocity and age are here because nothing else covers them.
    return signals


def _corroboration_signals(ctx):
    nearby = ctx.get("nearby_other_citizens", 0)
    if nearby >= 3:
        return [_signal("strongly_corroborated", 12, f"{nearby} other citizens reported the same kind of issue nearby recently.")]
    if nearby >= 1:
        return [_signal("corroborated", 6, "Another citizen reported the same kind of issue nearby recently.")]
    return []


def _collusion_signals(ctx, location):
    """Cross-account copy-paste detection.

    The existing corroboration signal counts *different wording, same area* —
    that's a real community problem. This is the opposite shape: *same
    wording, unrelated accounts*, which is why it is scored separately.

    Geographic spread is what separates the two readings of identical text:
    twenty households on one street forwarding one photo of one open drain is
    a genuine incident with a template body, while the same body arriving from
    several districts is a coordinated broadcast. Only the second one is
    penalised; the first gets a small caution so a human still looks at it."""
    signals = []
    campaign = ctx.get("campaign") or {}
    # Everything in `campaign` counts *other* reports, so the ring size has to
    # add this submission back in. Comparing an others-only count against a
    # threshold that means "N accounts in total" shifts the trigger one report
    # late — with a minimum of 3, the third copy would go unremarked.
    total_citizens = campaign.get("distinct_citizens", 0) + 1

    if total_citizens < settings.COLLUSION_MIN_CITIZENS:
        return signals

    districts = {d for d in campaign.get("districts", []) if d}
    own_district = (location or {}).get("district")
    if own_district:
        districts.add(own_district)
    total_districts = max(1, len(districts))
    note = campaign.get("categories", [])

    if total_districts >= COLLUSION_MIN_DISTRICTS:
        impact = -20 - min(12, (total_citizens - settings.COLLUSION_MIN_CITIZENS) * 4)
        signals.append(_signal(
            "coordinated_campaign", impact,
            f"Identical wording has arrived from {total_citizens} unrelated account(s) "
            f"across {total_districts} district(s) within "
            f"{settings.COLLUSION_WINDOW_DAYS} days"
            f"{', filed under ' + '/'.join(note[:3]) if note else ''}. "
            "Looks like a broadcast template, not independent reports.",
        ))
    else:
        signals.append(_signal(
            "templated_text", -6,
            f"The same wording came from {total_citizens} accounts, all in "
            f"{own_district or 'one'} area — likely one "
            "real problem circulated locally. Worth confirming, not doubting.",
        ))

    return signals


def _trust_signals(ctx):
    """What the account's own adjudicated history says about this report.

    Only counts things a human or the lifecycle already decided (staff flags,
    citizen-verified closures, withdrawals) — never the authenticity score of
    past reports, or a bad scorer would amplify itself into a permanent
    blacklist.

    Reads the record, not just the level band: "level 1" on its own doesn't
    tell you *why*, and wording a signal off the wrong reason is worse than no
    signal at all."""
    trust = ctx.get("trust")
    if not trust or trust.get("score") is None:
        return []

    record = trust.get("record") or {}
    flags = record.get("flagged_false", 0)
    verified = record.get("verified_resolved", 0)
    level = trust.get("level", 0)
    score = trust["score"]
    label = trust.get("label", "STANDARD")

    if level >= 2:
        impact = -12 if level == 2 else -20
        return [_signal(
            "low_trust_account", impact,
            f"Account trust {score} ({label}): {flags} earlier report(s) were "
            "marked false by staff. This one needs stronger evidence than usual.",
        )]

    if flags >= 1:
        return [_signal(
            "prior_substantiated_flag", -8,
            f"One earlier report from this account ({score} trust, {label}) was "
            "marked false by staff.",
        )]

    if verified >= 2 and score >= 75:
        return [_signal(
            "trusted_account", 10,
            f"Account trust {score}: {verified} earlier reports were confirmed "
            "and resolved.",
        )]

    if verified >= 1:
        return [_signal(
            "verified_history", 6,
            "An earlier report from this account was confirmed and resolved.",
        )]

    return []


def _consistency_signals(ai):
    signals = []
    word_count = ai.get("word_count", 0)

    if ai.get("priority") in ("HIGH", "CRITICAL") and word_count < 6:
        signals.append(_signal("severe_but_vague", -10, "Claims high severity but gives almost no detail."))

    if ai.get("duplicate"):
        signals.append(_signal("repeat_of_own_report", -10, "Closely repeats an earlier report from the same account."))

    return signals


def _verdict_for(score):
    if score >= GENUINE_THRESHOLD:
        return LIKELY_GENUINE
    if score >= REVIEW_THRESHOLD:
        return NEEDS_REVIEW
    return LIKELY_FAKE


def _fuse_with_ai(rule_score, signals, ai_read):
    """Merge the rule score with an independent AI read of the same text.

    Two asymmetric caps, both deliberate:
      - The AI can never be the only reason a report is called LIKELY_FAKE.
        A well-written fabrication can persuade a language model; the rules
        carry the corroborating facts the model can't see (GPS, history,
        photo reuse). So if the rules didn't reach the fake band, the fused
        score is floored just inside NEEDS_REVIEW.
      - The AI can never be the only reason a report is *cleared*. If the
        rules put it in the fake band, the AI cannot lift it back above
        NEEDS_REVIEW — it can only downgrade a case for human eyes, which is
        always safe, never promote one, which is not.
    A large disagreement between the two estimators is itself reported,
    because that is precisely where a human adds the most value."""
    if not ai_read or ai_read.get("score") is None:
        return rule_score, "rules", False

    weight = max(0.0, min(0.5, settings.AUTHENTICITY_LLM_WEIGHT))
    ai_score = ai_read["score"]
    fused = round((1 - weight) * rule_score + weight * ai_score)

    rule_verdict = _verdict_for(rule_score)
    ai_verdict = ai_read.get("verdict")

    if rule_verdict != LIKELY_FAKE and _verdict_for(fused) == LIKELY_FAKE:
        # AI alone pushing it over the fake line — hold it at review instead.
        fused = max(fused, REVIEW_THRESHOLD)
    if rule_verdict == LIKELY_FAKE and _verdict_for(fused) == LIKELY_GENUINE:
        # AI alone rescuing a case the rules condemn — keep it visible.
        fused = min(fused, GENUINE_THRESHOLD - 1)

    disagreement = abs(rule_score - ai_score) >= 30
    basis = "rules+ai" if ai_verdict else "rules"

    if disagreement:
        signals.append(_signal(
            "estimator_disagreement", 0,
            f"Rules scored this {rule_score}/100; the AI read scored it "
            f"{ai_score}/100 ({str(ai_verdict).lower() if ai_verdict else 'no verdict'}). "
            "A human should decide.",
        ))

    return fused, basis, disagreement


def evaluate_authenticity(text, location=None, address=None, attachments=None,
                          ai=None, context=None, ai_read=None):
    """Pure scoring function — no database access, easy to test.

    `ai_read` is the optional independent AI authenticity read (see
    _fuse_with_ai); `context` carries the DB-derived signals."""
    ai = dict(ai or {})
    ai["word_count"] = len(text.split())
    context = context or {}

    signals = []
    signals += _text_quality_signals(text)
    signals += _specificity_signals(text)
    signals += _location_signals(location, address)
    signals += _evidence_signals(attachments, context)
    signals += _behavior_signals(context)
    signals += _corroboration_signals(context)
    signals += _collusion_signals(context, location)
    signals += _trust_signals(context)
    signals += _consistency_signals(ai)

    rule_score = max(0, min(100, BASE_SCORE + sum(s["impact"] for s in signals)))
    score, basis, disagreement = _fuse_with_ai(rule_score, signals, ai_read)
    verdict = _verdict_for(score)

    return {
        "score": score,
        "verdict": verdict,
        "signals": sorted(signals, key=lambda s: s["impact"]),
        "checked_at": datetime.utcnow(),
        # Kept for the audit trail: what the rules alone concluded, before
        # the AI read was merged in.
        "rule_score": rule_score,
        "rule_verdict": _verdict_for(rule_score),
        "basis": basis,
        "estimator_disagreement": disagreement,
    }


def gather_context(citizen_id, category, location, grievance_id,
                   fingerprint=None, signatures=None):
    """Database lookups feeding the behavior, corroboration, collusion,
    evidence-reuse and trust signals.
    Best-effort: if any lookup fails the check still runs on what it has,
    rather than failing grievance submission."""
    from app.config.database import users_collection, grievances_collection

    ctx = {}
    now = datetime.utcnow()

    try:
        user = users_collection.find_one({"_id": citizen_id}, {"created_at": 1})
        if user and user.get("created_at"):
            ctx["account_age_hours"] = (now - user["created_at"]).total_seconds() / 3600

        ctx["submissions_last_hour"] = grievances_collection.count_documents(
            {"citizen_id": citizen_id, "grievance_id": {"$ne": grievance_id},
             "created_at": {"$gte": now - timedelta(hours=1)}}
        )
        ctx["submissions_last_24h"] = grievances_collection.count_documents(
            {"citizen_id": citizen_id, "grievance_id": {"$ne": grievance_id},
             "created_at": {"$gte": now - timedelta(hours=24)}}
        )
    except Exception as error:
        print(f"WARNING: authenticity behavior lookup failed: {error}")

    try:
        if location and location.get("coordinates"):
            nearby = grievances_collection.find(
                {
                    "location": {"$near": {"$geometry": {"type": "Point", "coordinates": location["coordinates"]},
                                           "$maxDistance": 1000}},
                    "category": category,
                    "citizen_id": {"$ne": citizen_id},
                    "created_at": {"$gte": now - timedelta(days=14)},
                    "flagged_invalid": {"$ne": True},
                },
                {"citizen_id": 1},
            ).limit(20)
            ctx["nearby_other_citizens"] = len({doc["citizen_id"] for doc in nearby})
    except Exception as error:
        print(f"WARNING: authenticity corroboration lookup failed: {error}")

    # --- collusion: the same wording arriving from unrelated accounts ---
    try:
        if fingerprint:
            since = now - timedelta(days=settings.COLLUSION_WINDOW_DAYS)
            twins = grievances_collection.find(
                {
                    "content_fingerprint": fingerprint,
                    "grievance_id": {"$ne": grievance_id},
                    "created_at": {"$gte": since},
                },
                {"citizen_id": 1, "district": 1, "category": 1},
            ).limit(200)
            rows = list(twins)
            ctx["campaign"] = {
                "matches": len(rows),
                "distinct_citizens": len({
                    r["citizen_id"] for r in rows
                    if r.get("citizen_id") and r["citizen_id"] != citizen_id
                }),
                # The *other* reports' districts, as a list — _collusion_signals
                # adds this report's own district, so the set has to survive
                # here rather than being flattened to a count that excludes it.
                "districts": sorted({r.get("district") for r in rows if r.get("district")}),
                "categories": sorted({r.get("category") for r in rows if r.get("category")})[:4],
            }
    except Exception as error:
        print(f"WARNING: authenticity collusion lookup failed: {error}")

    # --- recycled evidence: this exact photo already submitted elsewhere ---
    try:
        if signatures:
            since = now - timedelta(days=settings.EVIDENCE_REUSE_WINDOW_DAYS)
            rows = list(grievances_collection.find(
                {
                    "attachments.signature": {"$in": sorted(signatures)},
                    "grievance_id": {"$ne": grievance_id},
                    "created_at": {"$gte": since},
                },
                {"citizen_id": 1, "district": 1, "category": 1},
            ).limit(200))

            foreign = [r for r in rows if r.get("citizen_id") and r["citizen_id"] != citizen_id]
            own = [r for r in rows if r.get("citizen_id") == citizen_id]

            # "Different problem" = different category, or a different district
            # than this report claims. Same category *and* same area is the
            # forwarded-photo-of-one-real-incident case, which is far weaker.
            spans_scope = any(
                (r.get("category") and r.get("category") != category)
                or (r.get("district") and location and r.get("district") != location.get("district"))
                for r in foreign
            )

            ctx["evidence_reuse"] = {
                "matches": len(rows),
                "other_citizens": len({r["citizen_id"] for r in foreign}),
                "foreign_matches": len(foreign),
                "own_matches": len(own),
                "spans_scope": spans_scope,
                "scope_note": "different category or area" if spans_scope else "same area and category",
            }
    except Exception as error:
        print(f"WARNING: authenticity evidence-reuse lookup failed: {error}")

    # --- account standing ---
    try:
        from app.services.trust_service import compute_trust
        ctx["trust"] = compute_trust(citizen_id, persist=False)
    except Exception as error:
        print(f"WARNING: trust lookup failed: {error}")

    return ctx


def staff_recommendation(result):
    """One plain instruction for the reviewing officer. The score is for
    ranking the queue; this is for acting on one case."""
    verdict = result["verdict"]
    negatives = [s for s in result["signals"] if s["impact"] < 0]
    top = negatives[0]["signal"] if negatives else None

    if verdict == LIKELY_FAKE:
        return (
            "Do not dispatch yet. Ask the citizen for a photo or one more "
            f"detail (strongest concern: {top or 'low overall credibility'})."
        )
    if verdict == NEEDS_REVIEW:
        return "Routable, but confirm the location before spending a field visit" + (
            f" (watch: {top})." if top else "."
        )
    return "Nothing here suggests a fabricated report. Handle normally."


def _ai_context_note(location, grievance):
    """Give the model facts it cannot observe from the text alone (a photo was
    attached, which area), but never our own rule scores — feeding a model the
    answer you want it to reach makes it agree instead of judge."""
    parts = []
    district = (location or {}).get("district")
    if district:
        parts.append(f"Reported area: {district} district.")
    if grievance.get("attachments"):
        parts.append("The citizen attached a photo.")
    if grievance.get("category"):
        parts.append(f"Filed as a {str(grievance['category']).lower().replace('_', ' ')} issue.")
    if not parts:
        return ""
    return "\n\nFacts from the submission form (not part of the complaint text):\n" + "\n".join(
        f"- {p}" for p in parts
    )


def check_grievance_authenticity(grievance, use_ai=None):
    """Entry point used by create_grievance(). `grievance` is the in-memory
    document after AI analysis, before/at insertion.

    Also writes back the derived fields future lookups depend on:
    content_fingerprint (collusion) and per-attachment signatures (reuse)."""
    text = f"{grievance.get('title', '')}. {grievance.get('description', '')}"
    if grievance.get("voice_transcript"):
        text += f" {grievance['voice_transcript']}"

    location = grievance.get("location")

    attachments = sign_attachments(grievance.get("attachments"))
    if attachments:
        grievance["attachments"] = attachments
    signatures = {a["signature"] for a in attachments if a.get("signature")}

    fingerprint = content_fingerprint(
        f"{grievance.get('title', '')} {grievance.get('description', '')}"
    )
    if fingerprint:
        grievance["content_fingerprint"] = fingerprint

    context = gather_context(
        grievance["citizen_id"], grievance.get("category"), location,
        grievance["grievance_id"], fingerprint=fingerprint, signatures=signatures,
    )

    ai_read = None
    fuse = settings.AUTHENTICITY_LLM_FUSION if use_ai is None else use_ai
    if fuse:
        try:
            from app.ai.provider import assess_authenticity_with_fallback
            ai_read = assess_authenticity_with_fallback(
                text, context_note=_ai_context_note(location, grievance),
            )
        except Exception as error:
            print(f"WARNING: AI authenticity read failed: {error}")
            ai_read = None

    result = evaluate_authenticity(
        text,
        location=location,
        address=(location or {}).get("address"),
        attachments=attachments,
        ai={"priority": grievance.get("priority"), "duplicate": grievance.get("duplicate")},
        context=context,
        ai_read=ai_read,
    )

    if ai_read:
        result["ai"] = {
            "verdict": ai_read.get("verdict"),
            "score": ai_read.get("score"),
            "indicators": ai_read.get("indicators", []),
            "reasoning": ai_read.get("reasoning"),
            "provider": ai_read.get("provider"),
        }
    if context.get("trust"):
        trust = context["trust"]
        result["trust"] = {
            "score": trust.get("score"),
            "level": trust.get("level"),
            "label": trust.get("label"),
            "flags": trust.get("record", {}).get("flagged_false", 0),
        }
    if context.get("campaign", {}).get("matches"):
        result["campaign"] = context["campaign"]
    if context.get("evidence_reuse", {}).get("matches"):
        result["evidence_reuse"] = context["evidence_reuse"]
    if fingerprint:
        result["fingerprint"] = fingerprint

    result["recommendation"] = staff_recommendation(result)
    return result