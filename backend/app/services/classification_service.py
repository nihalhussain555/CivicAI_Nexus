"""
Department classification service.

The classifier may come from the trained ML model, but its final
output is ALWAYS normalized against the canonical department list.

Flow:

complaint
   ↓
trained model / strong multilingual rules
   ↓
normalize_department()
   ↓
canonical department
"""

from pathlib import Path
import math
import re

import joblib

from app.utils.constants import (
    DEPARTMENTS,
    DEPARTMENT_ALIASES,
    DEPARTMENT_TO_CATEGORY,
    normalize_department,
)


# ============================================================
# MODEL PATH
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parents[3]

MODEL_PATH = (
    PROJECT_ROOT
    / "ai"
    / "models"
    / "complaint_classifier.pkl"
)


_model = None


# ============================================================
# STRONG MULTILINGUAL PHRASES
# ============================================================
#
# These are safety rules for very obvious civic complaints.
# The ML model is still used for normal complaints.
# ============================================================

STRONG_PHRASES = {
    "Water Supply": [
        # English
        "drinking water",
        "water supply",
        "water is not coming",
        "water not coming",
        "no water",
        "water stopped",
        "water shortage",
        "water pipeline",
        "water pipe",
        "water connection",
        "water distribution",

        # Tamil
        "குடிநீர்",
        "தண்ணீர் வரவில்லை",
        "தண்ணீர் விநியோகம்",
        "குடிநீர் வரவில்லை",
        "குடிநீர் விநியோகம் இல்லை",
        "தண்ணீர் இல்லை",
        "தண்ணீர் கிடைக்கவில்லை",
        "குடிநீர் குழாய்",

        # Hindi
        "पीने का पानी",
        "पानी नहीं आ रहा",
        "पानी की आपूर्ति",
        "पानी नहीं आया",
        "पानी नहीं मिल रहा",
        "जल आपूर्ति",

        # Malayalam
        "കുടിവെള്ളം",
        "വെള്ളം ലഭിക്കുന്നില്ല",
        "വെള്ള വിതരണം",
        "വെള്ളം വരുന്നില്ല",
        "കുടിവെള്ള വിതരണം",
    ],

    "Drainage & Sewerage": [
        # English
        "sewage",
        "sewer",
        "sewerage",
        "drainage",
        "drain blocked",
        "blocked drain",
        "wastewater",
        "drain overflow",
        "sewer overflow",

        # Tamil
        "கழிவுநீர்",
        "சாக்கடை",
        "கால்வாய் அடைப்பு",
        "சாக்கடை அடைப்பு",
        "கழிவுநீர் கால்வாய்",

        # Hindi
        "सीवेज",
        "नाला बंद",
        "नाली बंद",
        "जल निकासी",
        "सीवर",

        # Malayalam
        "മലിനജലം",
        "സീവർ",
        "ഡ്രെയിനേജ്",
        "ഓട അടഞ്ഞു",
        "മാലിന്യജലം",
    ],

    "Electricity": [
        # English
        "electricity",
        "power cut",
        "power supply",
        "no power",
        "electric wire",
        "electrical wire",
        "transformer",
        "electric pole",
        "street light",

        # Tamil
        "மின்சாரம்",
        "மின்தடை",
        "மின்கம்பி",
        "மின்கம்பம்",
        "மின்சார கம்பம்",
        "தெருவிளக்கு",

        # Hindi
        "बिजली",
        "बिजली कटौती",
        "बिजली नहीं",
        "बिजली का तार",
        "ट्रांसफार्मर",
        "स्ट्रीट लाइट",

        # Malayalam
        "വൈദ്യുതി",
        "വൈദ്യുതി തടസം",
        "വൈദ്യുതി ഇല്ല",
        "വൈദ്യുതി വയർ",
        "ട്രാൻസ്ഫോർമർ",
        "തെരുവ് വിളക്ക്",
    ],

    "Roads & Highways": [
        # English
        "pothole",
        "potholes",
        "road damage",
        "damaged road",
        "broken road",
        "road repair",
        "highway",
        "road surface",

        # Tamil
        "சாலை பள்ளம்",
        "சாலை சேதம்",
        "சாலை பழுது",
        "சாலை உடைந்தது",
        "நெடுஞ்சாலை",

        # Hindi
        "सड़क पर गड्ढा",
        "सड़क खराब",
        "सड़क क्षतिग्रस्त",
        "सड़क की मरम्मत",
        "राजमार्ग",

        # Malayalam
        "റോഡിലെ കുഴി",
        "റോഡ് കേടായി",
        "റോഡ് തകർന്നു",
        "റോഡ് അറ്റകുറ്റപ്പണി",
        "ഹൈവേ",
    ],

    "Sanitation & Waste Management": [
        # English
        "garbage",
        "trash",
        "waste collection",
        "rubbish",
        "dustbin",
        "garbage collection",
        "waste pickup",
        "waste is not collected",
        "garbage is not collected",

        # Tamil
        "குப்பை",
        "குப்பை சேகரிப்பு",
        "குப்பை எடுக்கவில்லை",
        "கழிவு சேகரிப்பு",
        "குப்பைத்தொட்டி",

        # Hindi
        "कचरा",
        "कचरा संग्रह",
        "कचरा नहीं उठाया",
        "कूड़ा",
        "कूड़ेदान",

        # Malayalam
        "മാലിന്യം",
        "മാലിന്യ ശേഖരണം",
        "മാലിന്യം ശേഖരിക്കുന്നില്ല",
        "ചവറ്",
        "ചവറ്റുകുട്ട",
    ],

    "Police": [
        # English
        "theft",
        "stolen",
        "police complaint",
        "crime",
        "threat",
        "robbery",
        "burglary",
        "assault",
        "missing person",

        # Tamil
        "திருட்டு",
        "காவல்துறை",
        "மிரட்டல்",
        "கொள்ளை",
        "குற்றம்",

        # Hindi
        "चोरी",
        "पुलिस शिकायत",
        "धमकी",
        "लूट",
        "अपराध",

        # Malayalam
        "മോഷണം",
        "പോലീസ് പരാതി",
        "ഭീഷണി",
        "കവർച്ച",
        "കുറ്റകൃത്യം",
    ],
}


# ============================================================
# TEXT NORMALIZATION
# ============================================================

def _normalize_text(text: str) -> str:
    text = str(text or "").strip()

    if not text:
        return ""

    text = re.sub(r"\s+", " ", text)

    return text


# ============================================================
# MODEL LOADING
# ============================================================

def _load_model():
    global _model

    if _model is not None:
        return _model

    if not MODEL_PATH.exists():
        print(
            f"WARNING: Department model not found: {MODEL_PATH}"
        )
        return None

    try:
        _model = joblib.load(MODEL_PATH)

        print(
            f"CivicAI department model loaded: {MODEL_PATH}"
        )

        return _model

    except Exception as error:
        print(
            f"WARNING: Could not load department model: {error}"
        )
        return None


# ============================================================
# CONFIDENCE
# ============================================================

def _softmax(values):
    if not values:
        return []

    maximum = max(values)

    exponentials = [
        math.exp(
            max(
                -50,
                min(50, value - maximum),
            )
        )
        for value in values
    ]

    total = sum(exponentials)

    if total <= 0:
        return [0.0 for _ in values]

    return [
        value / total
        for value in exponentials
    ]


# ============================================================
# DEPARTMENT NORMALIZATION
# ============================================================

def _canonical_department(value):
    if not value:
        return None

    value = str(value).strip()

    if value in DEPARTMENTS:
        return value

    return DEPARTMENT_ALIASES.get(value)


# ============================================================
# STRONG RULE MATCHING
# ============================================================

def _rule_override(text):
    lowered = text.lower()

    matches = []

    for department, phrases in STRONG_PHRASES.items():
        score = 0

        for phrase in phrases:
            if phrase.lower() in lowered:
                score += 1

        if score:
            matches.append(
                (
                    department,
                    score,
                )
            )

    if not matches:
        return None

    matches.sort(
        key=lambda item: item[1],
        reverse=True,
    )

    return matches[0][0]


# ============================================================
# MODEL PREDICTION
# ============================================================

def _model_prediction(text):
    model = _load_model()

    if model is None:
        return None

    try:
        prediction = model.predict([text])[0]

        raw_department = str(prediction).strip()

        department = _canonical_department(
            raw_department
        )

        if department is None:
            return None

        confidence = 0.50

        if hasattr(model, "decision_function"):
            scores = model.decision_function([text])

            if hasattr(scores, "ndim") and scores.ndim == 2:
                values = scores[0]

                probabilities = _softmax(
                    [float(value) for value in values]
                )

                if probabilities:
                    confidence = max(probabilities)

        return {
            "department": department,
            "confidence": float(confidence),
        }

    except Exception as error:
        print(
            f"WARNING: Department prediction failed: {error}"
        )

        return None


# ============================================================
# PUBLIC CLASSIFICATION FUNCTION
# ============================================================

def classify_complaint(text):
    text = _normalize_text(text)

    if not text:
        return {
            "category": "GENERAL",
            "department": "Municipal Corporation",
            "confidence": 0.10,
            "scores": {},
        }

    # --------------------------------------------------------
    # ML prediction
    # --------------------------------------------------------

    prediction = _model_prediction(text)

    # --------------------------------------------------------
    # Strong multilingual rule
    # --------------------------------------------------------

    rule_department = _rule_override(text)

    if rule_department:
        department = rule_department

        model_confidence = (
            prediction["confidence"]
            if prediction
            else 0.0
        )

        confidence = max(
            0.90 if prediction and
            prediction["department"] == rule_department
            else 0.82,
            model_confidence,
        )

    elif prediction:
        department = prediction["department"]
        confidence = prediction["confidence"]

    else:
        department = "Municipal Corporation"
        confidence = 0.20

    # --------------------------------------------------------
    # FINAL CANONICAL VALIDATION
    # --------------------------------------------------------

    department = _canonical_department(
        department
    )

    if department is None:
        department = "Municipal Corporation"
        confidence = min(confidence, 0.20)

    category = DEPARTMENT_TO_CATEGORY.get(
        department,
        "GENERAL",
    )

    return {
        "category": category,
        "department": department,
        "confidence": round(
            min(0.99, max(0.0, confidence)),
            4,
        ),
        "scores": {},
    }