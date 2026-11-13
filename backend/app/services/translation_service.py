"""
Regional-language understanding for the citizen pipeline.

Two layers, deliberately separated:

1. A deterministic local read (`analyze_language`) — script-range evidence
   plus transliteration cues for Latin-script "code-mixed" text like
   "garbage bin illa sir". No network, no cost, stable enough to unit-test
   and to run on every single complaint.
2. A provider read (`understand_text`) — when the configured AI provider can
   do a plain completion, the model confirms the language, marks real
   code-mixing and renders the text in English, which is the language the
   rest of the system (keyword rules, duplicate matching, officer-facing
   summaries) processes. Mock/offline mode simply keeps the citizen's own
   words and says so, rather than pretending a translation happened.

`detect_language` and `translate_text` keep their historical signatures
because `ai_pipeline_service.run_pipeline` is built around them; the local
detector is what those calls resolve to, so a Tamil complaint in offline
mode behaves exactly as it did before.
"""

import re

from app.config.settings import settings


SUPPORTED_LANGUAGES = {
    "English": "en",
    "Hindi": "hi",
    "Tamil": "ta",
    "Malayalam": "ml",
    "Telugu": "te",
    "Kannada": "kn",
}

CODE_TO_LANGUAGE = {code: name for name, code in SUPPORTED_LANGUAGES.items()}

# Every language the assistant will accept, including ones the deterministic
# detector can only recognise by script. Kept as a single source of truth so
# speech, detection and the complaint form cannot drift apart.
LANGUAGE_NAMES = list(SUPPORTED_LANGUAGES)

# The language the rest of the backend thinks in: classification keywords,
# duplicate matching and officer-facing summaries are all English.
PROCESSING_LANGUAGE = "English"

# Unicode blocks, one per supported Indic language. These blocks do not
# overlap, so a character count is unambiguous script evidence.
SCRIPT_RANGES = {
    "Hindi": ("\u0900", "\u097F"),        # Devanagari
    "Tamil": ("\u0B80", "\u0BFF"),
    "Telugu": ("\u0C00", "\u0C7F"),
    "Kannada": ("\u0C80", "\u0CFF"),
    "Malayalam": ("\u0D00", "\u0D7F"),
}

# Text typed or transcribed in Latin letters is the ambiguous case: plain
# English and romanized Tamil both look like Latin script. These are high
# frequency function words per language — the giveaway when a citizen writes
# their grammar in English words but their mother tongue's connectives, or
# types the whole complaint in transliteration.
TRANSLITERATION_CUES = {
    "Tamil": (
        "iruku", "irukkum", "irukka", "illai", "illa", "venum", "vendum",
        "pepan", "pannu", "pannunga", "sapiduga", "kudukanum", "kudunga",
        "enna", "eppadi", "evlo", "vandi", "aana", "ayiduchu", "ayithu",
        "niram", "kuzai", "kuzhappam", "manam", "podhum", "kavalai",
    ),
    "Malayalam": (
        "undo", "illa", "venam", "venamenn", "cheyyam", "cheyyi", "koodi",
        "valaram", "njangal", "ente", "ethrana", "evazhiyunnath",
        "kuranj", "maarayi", "kettiyirikkunna",
    ),
    "Hindi": (
        "hai", "nahi", "nahin", "karo", "kyun", "kyunki", "mujhe", "hamare",
        "hamara", "bahut", "kripaya", "kijiega", "raha", "wala", "wali",
        "paani", "sadak", "bijli", "koi", "zaroorat", "mushkil",
    ),
    "Telugu": (
        "unnayi", "ledu", "cheppanga", "cheyyali", "kaavali", "naaku",
        "meeru", "ekkuva", "bagunnadi", "vastundi", "padutundi", "damakam",
    ),
    "Kannada": (
        "ide", "illa", "madi", "nodbi", "kodu", "beka", "naavige", "khub",
        "agutte", "aytu", "maduve", "reshte", "goli",
    ),
}

# Words that are unambiguous English even inside a transliterated sentence,
# so a single Indic cue word doesn't flip a mostly-English complaint.
COMMON_ENGLISH_WORDS = frozenset(
    """the and with for from have has was were your our their this that
    street water light garbage please problem report not near since""".split()
)

# Cues are matched as whole words. The "enna" hiding inside "Chennai" is a
# substring match away from reading a plain English complaint as transliterated
# Tamil — and Indian place names, which voice transcripts are full of, are
# exactly where those accidental syllables live.
_CUE_PATTERNS = {
    language: re.compile(rf"\b(?:{'|'.join(cues)})\b")
    for language, cues in TRANSLITERATION_CUES.items()
}


def _script_counts(text: str) -> dict:
    counts = {language: 0 for language in SCRIPT_RANGES}
    for char in text:
        for language, (start, end) in SCRIPT_RANGES.items():
            if start <= char <= end:
                counts[language] += 1
                break
    return counts


def _latin_letter_count(text: str) -> int:
    return sum(1 for char in text if ("a" <= char.lower() <= "z"))


def _indic_word_count(text: str) -> int:
    """Words carried by an Indic script rather than Latin letters. Counting
    words, not characters, is what keeps a Tamil place-name inside an
    otherwise English sentence reading as English."""
    return sum(1 for token in text.split() if _is_indic_token(token))


def _is_indic_token(token: str) -> bool:
    return any(
        start <= char <= end
        for char in token
        for start, end in SCRIPT_RANGES.values()
    )


def _is_latin_token(token: str) -> bool:
    return not _is_indic_token(token) and any(
        "a" <= char.lower() <= "z" for char in token
    )


def analyze_language(text: str) -> dict:
    """Deterministic, offline read of what language a piece of citizen text
    is in. Returns the dominant language, whether the text mixes languages
    (Indic script + Latin words, or transliteration), and a confidence
    figure that is honestly low when the evidence is thin."""
    text = (text or "").strip()
    if not text:
        return _result("English", code_mixed=False, confidence=0.0, evidence="empty text")

    counts = _script_counts(text)
    latin = _latin_letter_count(text)
    total_indic = sum(counts.values())
    tokens = text.split()
    indic_words = sum(1 for token in tokens if _is_indic_token(token))
    latin_words = sum(1 for token in tokens if _is_latin_token(token))

    top_language, top_count = max(counts.items(), key=lambda item: item[1])
    other_scripts = [
        language for language, count in counts.items()
        if language != top_language and count >= 3
    ]

    if total_indic and top_count:
        share = top_count / (top_count + latin)
        # The Indic script wins when it carries most of the letters, or when
        # it contributes a whole sentence rather than a stray place-name —
        # three regional words is enough to be the language the message is
        # actually being said in, however many English nouns ride along.
        if (
            share >= 0.5
            or indic_words >= 3
            or (indic_words >= 2 and indic_words >= latin_words)
        ):
            return _result(
                top_language,
                code_mixed=bool(latin_words or other_scripts),
                confidence=round(0.7 + 0.3 * share, 2),
                evidence=f"{top_count} characters in the {top_language} script",
                other_scripts=other_scripts,
            )

    # Latin-only (or too little Indic script to be decisive): look for
    # transliterated function words, which is how people actually type when
    # their keyboard or phone has no Indic layout.
    lowered = text.lower()
    words = {
        word.strip(".,!?;:\"'()")
        for word in lowered.split()
    }
    english_hits = len(words & COMMON_ENGLISH_WORDS)

    cue_scores = {}
    for language, pattern in _CUE_PATTERNS.items():
        hits = len(set(pattern.findall(lowered)))
        if hits:
            cue_scores[language] = hits

    if cue_scores:
        best_language, best_hits = max(cue_scores.items(), key=lambda item: item[1])
        if best_hits >= english_hits:
            return _result(
                best_language,
                code_mixed=bool(english_hits),
                confidence=round(min(0.5 + 0.12 * best_hits, 0.9), 2),
                evidence=f"transliterated {best_language} wording",
                other_scripts=[
                    language for language, hits in cue_scores.items()
                    if language != best_language and hits >= 2
                ],
            )

    # English-dominant. Any Indic words left in the message are reported as
    # code-mixing so the caller can still show the citizen what it heard.
    if latin == 0 and total_indic == 0:
        return _result("English", code_mixed=False, confidence=0.0, evidence="no letters to read")

    return _result(
        "English",
        code_mixed=indic_words > 0,
        confidence=0.75,
        evidence="Latin script, no regional cues",
        other_scripts=[top_language] if indic_words else [],
    )


def _result(language, code_mixed, confidence, evidence, other_scripts=None) -> dict:
    others = other_scripts or []
    return {
        "language": language,
        "language_code": SUPPORTED_LANGUAGES[language],
        "code_mixed": bool(code_mixed or others),
        "mixed_with": [CODE_TO_LANGUAGE.get(o, o) for o in others],
        "confidence": confidence,
        "evidence": evidence,
    }


def detect_language(text):
    """Historic entry point used by the AI pipeline: just the language name."""
    return analyze_language(text)["language"]


def is_code_mixed(text) -> bool:
    return analyze_language(text)["code_mixed"]


def language_name(value) -> str:
    """Accept an English name, a 2-letter code, or "Auto"/None and return a
    supported language name. Unknown values fall through to English, which is
    what the complaint form has always done."""
    if not value or str(value).strip().lower() in ("auto", ""):
        return PROCESSING_LANGUAGE
    text = str(value).strip()
    if text in SUPPORTED_LANGUAGES:
        return text
    code = CODE_TO_LANGUAGE.get(text.lower()[:2])
    return code or PROCESSING_LANGUAGE


def translate_text(text, source_language, target_language=PROCESSING_LANGUAGE) -> str:
    """Render complaint text in the processing language.

    Offline mode returns the citizen's own words unchanged and lets the
    caller's `understand_text` result carry the honest 'no translation
    happened' flag; silently inventing an English version would be worse."""
    if not text or source_language == target_language:
        return text
    return understand_text(text, hint=source_language)["translated_text"]


def understand_text(text: str, hint: str = None) -> dict:
    """Full regional-language read for one piece of citizen text.

    Returns {language, language_code, code_mixed, confidence, evidence,
    translated_text, translated, translation_provider}. The local read always
    runs (it is free and decides the fallback); the provider read overrides it
    when the model gives a usable answer."""
    local = analyze_language(text)
    result = {
        **local,
        "translated_text": text,
        "translated": False,
        "translation_provider": "offline",
    }

    # An explicit hint from the citizen ("I'm writing in Tamil") outranks the
    # detector, which is exactly how the report form's language select works.
    if hint and str(hint).strip().lower() not in ("auto", ""):
        named = language_name(hint)
        if named != local["language"]:
            result.update({
                "language": named,
                "language_code": SUPPORTED_LANGUAGES[named],
                "evidence": f"chosen by the citizen: {named}",
                "confidence": max(local["confidence"], 0.9),
            })

    if result["language"] == PROCESSING_LANGUAGE and not result["code_mixed"]:
        # Nothing to do: English-only text is already in the processing
        # language, so no provider call is burned on it.
        return result

    provider_read = _provider_understanding(text, result["language"])
    if not provider_read:
        return result

    translated = provider_read.get("translated_text") or text
    if translated.strip() and translated.strip().lower() != (text or "").strip().lower():
        result["translated_text"] = translated
        result["translated"] = True
    result["translation_provider"] = provider_read.get("provider", "unknown")

    # The model's language call replaces the detector's only when it is a
    # language we actually support; a model answering "Urdu" would otherwise
    # send the pipeline off the map.
    model_language = provider_read.get("language")
    if model_language in SUPPORTED_LANGUAGES and not (hint and str(hint).strip().lower() not in ("auto", "")):
        result["language"] = model_language
        result["language_code"] = SUPPORTED_LANGUAGES[model_language]
        result["evidence"] = f"confirmed by {result['translation_provider']}"
    if provider_read.get("code_mixed") is not None:
        result["code_mixed"] = bool(provider_read["code_mixed"])
    if provider_read.get("confidence") is not None:
        result["confidence"] = provider_read["confidence"]
    return result


def _provider_understanding(text: str, source_language: str):
    """Ask the configured provider for the language read. Returns None for
    any provider that cannot do a plain completion (mock) or any failure —
    callers then keep the deterministic local answer."""
    if settings.AI_PROVIDER == "mock":
        return None

    from app.ai.provider import get_ai_provider

    try:
        return get_ai_provider().understand_language(text, source_language)
    except Exception as error:  # noqa: BLE001
        print(f"WARNING: language understanding failed, using local detection: {error}")
        return None
