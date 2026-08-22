HIGH_PRIORITY = [

    "danger",
    "emergency",
    "accident",
    "fire",
    "electric shock",
    "fallen wire",
    "severe flooding",
    "hospital",
    "life threatening",
    "death"
]


MEDIUM_PRIORITY = [

    "urgent",
    "overflow",
    "blocked",
    "broken",
    "leak",
    "not working",
    "damaged",
    "flood"
]


def predict_priority(text):

    text = text.lower()

    high_matches = [
        word
        for word in HIGH_PRIORITY
        if word in text
    ]

    if high_matches:

        return {
            "priority": "HIGH",
            "score": 90,
            "matched_keywords": high_matches
        }

    medium_matches = [
        word
        for word in MEDIUM_PRIORITY
        if word in text
    ]

    if medium_matches:

        return {
            "priority": "MEDIUM",
            "score": 65,
            "matched_keywords": medium_matches
        }

    return {
        "priority": "LOW",
        "score": 35,
        "matched_keywords": []
    }