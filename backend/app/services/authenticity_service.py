"""
Grievance authenticity check — "is this complaint likely real?", separate
from duplicate detection (which only asks "have we seen this one before?").

There is no single reliable test for a fake complaint, so this combines
several weak signals into an explainable 0-100 credibility score:

  1. Text quality     — gibberish, keyboard-mashing, test/spam phrases
  2. Specificity      — concrete detail (landmarks, numbers, duration)
  3. Location         — coordinates plausible for the service area
  4. Evidence         — attached photos
  5. Account behavior — submission bursts, past flagged reports, track record
  6. Corroboration    — other citizens reporting the same thing nearby

The result is a triage aid, NOT a verdict: it never rejects a complaint.
Low scores route the case to a human (staff see the breakdown; citizens
never do, so the rules can't be reverse-engineered and gamed).
"""

import re
import unicodedata
from datetime import datetime, timedelta

# Generous box around Tamil Nadu + a margin for border districts.
VALID_LAT_RANGE = (7.8, 13.9)
VALID_LON_RANGE = (75.8, 80.9)

LIKELY_GENUINE = "LIKELY_GENUINE"
NEEDS_REVIEW = "NEEDS_REVIEW"
LIKELY_FAKE = "LIKELY_FAKE"

GENUINE_THRESHOLD = 65
REVIEW_THRESHOLD = 40

BASE_SCORE = 70

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


def _evidence_signals(attachments):
    if attachments:
        return [_signal("photo_attached", 10, f"{len(attachments)} photo(s) attached as evidence.")]
    return []


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

    flagged = ctx.get("previously_flagged", 0)
    if flagged >= 2:
        signals.append(_signal("repeat_flagged", -30, f"{flagged} earlier reports from this account were flagged false."))
    elif flagged == 1:
        signals.append(_signal("prior_flag", -15, "An earlier report from this account was flagged false."))

    closed = ctx.get("previously_closed", 0)
    if flagged == 0 and closed >= 3:
        signals.append(_signal("good_track_record", 15, f"{closed} earlier reports were verified and resolved."))
    elif flagged == 0 and closed >= 1:
        signals.append(_signal("some_track_record", 8, "Has an earlier report that was verified and resolved."))

    return signals


def _corroboration_signals(ctx):
    nearby = ctx.get("nearby_other_citizens", 0)
    if nearby >= 3:
        return [_signal("strongly_corroborated", 12, f"{nearby} other citizens reported the same kind of issue nearby recently.")]
    if nearby >= 1:
        return [_signal("corroborated", 6, "Another citizen reported the same kind of issue nearby recently.")]
    return []


def _consistency_signals(ai):
    signals = []
    word_count = ai.get("word_count", 0)

    if ai.get("priority") in ("HIGH", "CRITICAL") and word_count < 6:
        signals.append(_signal("severe_but_vague", -10, "Claims high severity but gives almost no detail."))

    if ai.get("duplicate"):
        signals.append(_signal("repeat_of_own_report", -10, "Closely repeats an earlier report from the same account."))

    return signals


def evaluate_authenticity(text, location=None, address=None, attachments=None, ai=None, context=None):
    """Pure scoring function — no database access, easy to test."""
    ai = dict(ai or {})
    ai["word_count"] = len(text.split())
    context = context or {}

    signals = []
    signals += _text_quality_signals(text)
    signals += _specificity_signals(text)
    signals += _location_signals(location, address)
    signals += _evidence_signals(attachments)
    signals += _behavior_signals(context)
    signals += _corroboration_signals(context)
    signals += _consistency_signals(ai)

    score = max(0, min(100, BASE_SCORE + sum(s["impact"] for s in signals)))

    if score >= GENUINE_THRESHOLD:
        verdict = LIKELY_GENUINE
    elif score >= REVIEW_THRESHOLD:
        verdict = NEEDS_REVIEW
    else:
        verdict = LIKELY_FAKE

    return {
        "score": score,
        "verdict": verdict,
        "signals": sorted(signals, key=lambda s: s["impact"]),
        "checked_at": datetime.utcnow(),
    }


def gather_context(citizen_id, category, location, grievance_id):
    """Database lookups feeding the behavior + corroboration signals.
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
        ctx["previously_flagged"] = grievances_collection.count_documents(
            {"citizen_id": citizen_id, "flagged_invalid": True}
        )
        ctx["previously_closed"] = grievances_collection.count_documents(
            {"citizen_id": citizen_id, "status": "CLOSED", "citizen_verified": True}
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

    return ctx


def check_grievance_authenticity(grievance):
    """Entry point used by create_grievance(). `grievance` is the in-memory
    document after AI analysis, before/at insertion."""
    text = f"{grievance.get('title', '')}. {grievance.get('description', '')}"
    if grievance.get("voice_transcript"):
        text += f" {grievance['voice_transcript']}"

    location = grievance.get("location")
    context = gather_context(
        grievance["citizen_id"], grievance.get("category"), location, grievance["grievance_id"]
    )

    return evaluate_authenticity(
        text,
        location=location,
        address=(location or {}).get("address"),
        attachments=grievance.get("attachments"),
        ai={"priority": grievance.get("priority"), "duplicate": grievance.get("duplicate")},
        context=context,
    )