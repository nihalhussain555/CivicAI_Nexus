from pathlib import Path
import math

import joblib


# ============================================================
# MODEL
# ============================================================

PROJECT_ROOT = (
    Path(__file__)
    .resolve()
    .parents[3]
)

MODEL_PATH = (
    PROJECT_ROOT
    / "ai"
    / "models"
    / "complaint_classifier.pkl"
)


_model = None


# ============================================================
# CANONICAL DEPARTMENTS
# ============================================================

DEPARTMENTS = [
    "Municipal Corporation",
    "Police",
    "Health",
    "Education",
    "Electricity",
    "Water Services",
    "Roads & Highways",
    "Waste Management",
    "Agriculture",
    "Housing",
    "Revenue & Land Records",
    "Food & Civil Supplies",
    "Transport",
    "Labour & Employment",
    "Women & Child Welfare",
    "Environment & Forest",
    "Social Welfare",
    "Public Works",
    "Rural Development / Panchayat",
    "e-Governance",
    "Drainage & Sewerage",
]


DEPARTMENT_TO_CATEGORY = {
    "Municipal Corporation":
        "GENERAL",

    "Police":
        "PUBLIC_SAFETY",

    "Health":
        "GENERAL",

    "Education":
        "GENERAL",

    "Electricity":
        "ELECTRICITY",

    "Water Services":
        "WATER",

    "Roads & Highways":
        "ROAD",

    "Waste Management":
        "WASTE",

    "Agriculture":
        "GENERAL",

    "Housing":
        "GENERAL",

    "Revenue & Land Records":
        "GENERAL",

    "Food & Civil Supplies":
        "GENERAL",

    "Transport":
        "TRAFFIC",

    "Labour & Employment":
        "GENERAL",

    "Women & Child Welfare":
        "GENERAL",

    "Environment & Forest":
        "GENERAL",

    "Social Welfare":
        "GENERAL",

    "Public Works":
        "ROAD",

    "Rural Development / Panchayat":
        "GENERAL",

    "e-Governance":
        "GENERAL",

    "Drainage & Sewerage":
        "DRAINAGE",
}


# ============================================================
# STRONG MULTILINGUAL SAFETY PHRASES
# ============================================================

STRONG_PHRASES = {
    "Water Services": [
        "drinking water",
        "water supply",
        "no water",
        "water is not coming",
        "water not coming",
        "water supply stopped",

        "குடிநீர்",
        "தண்ணீர் வரவில்லை",
        "தண்ணீர் விநியோகம்",
        "குடிநீர் வரவில்லை",
        "குடிநீர் விநியோகம் இல்லை",

        "पीने का पानी",
        "पानी नहीं आ रहा",
        "पानी की आपूर्ति",
        "पानी नहीं आया",

        "കുടിവെള്ളം",
        "വെള്ളം ലഭിക്കുന്നില്ല",
        "വെള്ള വിതരണം",
    ],

    "Drainage & Sewerage": [
        "sewage",
        "sewer",
        "drainage",
        "drain blocked",
        "wastewater",
        "sewerage",

        "கழிவுநீர்",
        "சாக்கடை",
        "கால்வாய் அடைப்பு",

        "सीवेज",
        "नाला बंद",
        "जल निकासी",

        "മലിനജലം",
        "സീവർ",
        "ഡ്രെയിനേജ്",
    ],

    "Electricity": [
        "electricity",
        "power cut",
        "power supply",
        "no power",
        "electric wire",
        "transformer",

        "மின்சாரம்",
        "மின்தடை",
        "மின்கம்பி",

        "बिजली",
        "बिजली कटौती",
        "ट्रांसफार्मर",

        "വൈദ്യുതി",
        "വൈദ്യുതി തടസം",
        "ട്രാൻസ്ഫോർമർ",
    ],

    "Roads & Highways": [
        "pothole",
        "road damage",
        "damaged road",
        "highway",
        "road repair",

        "சாலை பள்ளம்",
        "சாலை சேதம்",
        "நெடுஞ்சாலை",

        "सड़क पर गड्ढा",
        "सड़क खराब",
        "राजमार्ग",

        "റോഡിലെ കുഴി",
        "റോഡ് കേടായി",
        "ഹൈവേ",
    ],

    "Waste Management": [
        "garbage",
        "trash",
        "waste collection",
        "rubbish",
        "dustbin",
        "garbage collection",

        "குப்பை",
        "குப்பை சேகரிப்பு",
        "கழிவு",

        "कचरा",
        "कचरा संग्रह",
        "कूड़ा",

        "മാലിന്യം",
        "മാലിന്യ ശേഖരണം",
        "ചവറ്",
    ],

    "Police": [
        "theft",
        "stolen",
        "police complaint",
        "crime",
        "threat",
        "robbery",

        "திருட்டு",
        "காவல்துறை",
        "மிரட்டல்",

        "चोरी",
        "पुलिस शिकायत",
        "धमकी",

        "മോഷണം",
        "പോലീസ് പരാതി",
        "ഭീഷണി",
    ],
}


def _load_model():
    global _model

    if _model is not None:
        return _model

    if not MODEL_PATH.exists():
        print(
            f"WARNING: Department model not found: "
            f"{MODEL_PATH}"
        )

        return None

    try:
        _model = joblib.load(
            MODEL_PATH
        )

        return _model

    except Exception as error:
        print(
            "WARNING: Could not load "
            f"department model: {error}"
        )

        return None


def _softmax(values):
    if not values:
        return []

    maximum = max(values)

    exps = [
        math.exp(
            max(
                -50,
                min(
                    50,
                    value - maximum,
                ),
            )
        )
        for value in values
    ]

    total = sum(exps)

    if total == 0:
        return [
            0 for _ in values
        ]

    return [
        value / total
        for value in exps
    ]


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


def _model_prediction(text):
    model = _load_model()

    if model is None:
        return None

    try:
        prediction = model.predict(
            [text]
        )[0]

        confidence = 0.5

        if hasattr(
            model,
            "decision_function",
        ):
            scores = model.decision_function(
                [text]
            )

            if hasattr(
                scores,
                "ndim"
            ) and scores.ndim == 2:

                values = scores[0]

                probabilities = (
                    _softmax(
                        values
                    )
                )

                confidence = max(
                    probabilities
                )

        return {
            "department":
                str(prediction),
            "confidence":
                float(
                    confidence
                ),
        }

    except Exception as error:
        print(
            "WARNING: Department "
            f"prediction failed: {error}"
        )

        return None


def classify_complaint(text):
    text = (
        str(text or "")
        .strip()
    )

    if not text:
        return {
            "category":
                "GENERAL",
            "department":
                "Municipal Corporation",
            "confidence":
                0.1,
            "scores": {},
        }

    # ---------------------------------------------------------
    # FIRST: ML MODEL
    # ---------------------------------------------------------

    prediction = _model_prediction(
        text
    )

    # ---------------------------------------------------------
    # SECOND: STRONG MULTILINGUAL
    # OVERRIDE
    # ---------------------------------------------------------

    rule_department = (
        _rule_override(
            text
        )
    )

    if rule_department:
        model_department = (
            prediction["department"]
            if prediction
            else None
        )

        # Strong domain phrase wins.
        department = rule_department

        if (
            model_department
            == rule_department
        ):
            confidence = max(
                0.90,
                prediction[
                    "confidence"
                ]
                if prediction
                else 0.90,
            )
        else:
            confidence = max(
                0.82,
                prediction[
                    "confidence"
                ]
                if prediction
                else 0.82,
            )

    elif prediction:
        department = (
            prediction[
                "department"
            ]
        )

        confidence = (
            prediction[
                "confidence"
            ]
        )

    else:
        department = (
            "Municipal Corporation"
        )

        confidence = 0.20

    if department not in DEPARTMENTS:
        department = (
            "Municipal Corporation"
        )

        confidence = min(
            confidence,
            0.20,
        )

    category = (
        DEPARTMENT_TO_CATEGORY.get(
            department,
            "GENERAL",
        )
    )

    return {
        "category":
            category,
        "department":
            department,
        "confidence":
            round(
                min(
                    0.99,
                    confidence,
                ),
                4,
            ),
        "scores": {},
    }