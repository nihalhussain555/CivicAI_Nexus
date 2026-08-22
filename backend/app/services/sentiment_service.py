NEGATIVE_WORDS = [

    "angry",
    "worst",
    "terrible",
    "frustrated",
    "useless",
    "ignored",
    "danger",
    "problem",
    "complaint",
    "poor",
    "bad"
]


POSITIVE_WORDS = [

    "thank",
    "thanks",
    "good",
    "resolved",
    "happy",
    "excellent"
]


def analyze_sentiment(text):

    text = text.lower()

    negative_score = sum(
        1
        for word in NEGATIVE_WORDS
        if word in text
    )

    positive_score = sum(
        1
        for word in POSITIVE_WORDS
        if word in text
    )

    if negative_score > positive_score:

        return "NEGATIVE"

    if positive_score > negative_score:

        return "POSITIVE"

    return "NEUTRAL"