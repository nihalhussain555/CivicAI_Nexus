from pathlib import Path
import math

import joblib


PROJECT_ROOT = (
    Path(__file__)
    .resolve()
    .parents[3]
)

MODEL_PATH = (
    PROJECT_ROOT
    / "ai"
    / "models"
    / "priority_model.pkl"
)


_model = None


HIGH_PRIORITY = [
    "emergency",
    "danger",
    "dangerous",
    "accident",
    "fire",
    "electric shock",
    "fallen wire",
    "life threatening",
    "death",
    "stolen",
    "robbery",
    "threat",

    "அவசரம்",
    "ஆபத்து",
    "விபத்து",
    "தீ",
    "மின்சாரம் தாக்க",
    "திருட்டு",
    "மிரட்டல்",

    "आपातकाल",
    "खतरनाक",
    "दुर्घटना",
    "आग",
    "बिजली का झटका",
    "चोरी",
    "धमकी",

    "അടിയന്തര",
    "അപകടം",
    "തീ",
    "വൈദ്യുതി ഷോക്ക്",
    "മോഷണം",
    "ഭീഷണി",
]


CRITICAL_PRIORITY = [
    "life threatening",
    "life-threatening",
    "death",
    "fire emergency",
    "electric shock",
    "major accident",

    "உயிருக்கு ஆபத்து",
    "மரணம்",
    "தீ விபத்து",

    "जान का खतरा",
    "मौत",
    "आग",

    "ജീവന് ഭീഷണി",
    "മരണം",
]


MEDIUM_PRIORITY = [
    "urgent",
    "blocked",
    "overflow",
    "broken",
    "leak",
    "damaged",
    "not working",
    "flood",
    "delay",

    "அவசர",
    "அடைப்பு",
    "கசிவு",
    "சேதம்",
    "வேலை செய்யவில்லை",

    "तुरंत",
    "बंद",
    "रिसाव",
    "खराब",
    "देरी",

    "അടഞ്ഞ",
    "ചോർച്ച",
    "കേടായി",
    "പ്രവർത്തിക്കുന്നില്ല",
    "വൈകി",
]


def _load_model():
    global _model

    if _model is not None:
        return _model

    if not MODEL_PATH.exists():
        return None

    try:
        _model = joblib.load(
            MODEL_PATH
        )

        return _model

    except Exception as error:
        print(
            "WARNING: Priority model "
            f"load failed: {error}"
        )

        return None


def _model_prediction(text):
    model = _load_model()

    if model is None:
        return None

    try:
        prediction = (
            model.predict(
                [text]
            )[0]
        )

        confidence = 0.5

        if hasattr(
            model,
            "predict_proba",
        ):
            probabilities = (
                model.predict_proba(
                    [text]
                )[0]
            )

            confidence = float(
                max(
                    probabilities
                )
            )

        return {
            "priority":
                str(
                    prediction
                ).upper(),
            "confidence":
                confidence,
        }

    except Exception:
        return None


def predict_priority(text):
    text = str(
        text or ""
    ).strip()

    lowered = text.lower()

    critical_matches = [
        word
        for word in CRITICAL_PRIORITY
        if word.lower()
        in lowered
    ]

    if critical_matches:
        return {
            "priority":
                "CRITICAL",
            "score":
                98,
            "matched_keywords":
                critical_matches,
        }

    high_matches = [
        word
        for word in HIGH_PRIORITY
        if word.lower()
        in lowered
    ]

    if high_matches:
        return {
            "priority":
                "HIGH",
            "score":
                90,
            "matched_keywords":
                high_matches,
        }

    medium_matches = [
        word
        for word in MEDIUM_PRIORITY
        if word.lower()
        in lowered
    ]

    model_result = (
        _model_prediction(
            text
        )
    )

    if model_result:
        predicted = (
            model_result[
                "priority"
            ]
        )

        if (
            predicted
            == "CRITICAL"
        ):
            score = 95

        elif (
            predicted
            == "HIGH"
        ):
            score = 85

        elif (
            predicted
            == "MEDIUM"
        ):
            score = 60

        else:
            score = 30

        return {
            "priority":
                predicted,
            "score":
                score,
            "matched_keywords":
                medium_matches,
            "model_confidence":
                model_result[
                    "confidence"
                ],
        }

    if medium_matches:
        return {
            "priority":
                "MEDIUM",
            "score":
                65,
            "matched_keywords":
                medium_matches,
        }

    return {
        "priority":
            "LOW",
        "score":
            35,
        "matched_keywords":
            [],
    }