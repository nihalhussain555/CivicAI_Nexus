from app.services.classification_service import (
    classify_complaint
)

from app.services.priority_service import (
    predict_priority
)

from app.services.sentiment_service import (
    analyze_sentiment
)


def generate_summary(
    category,
    department,
    priority
):

    return (
        f"Citizen reported a "
        f"{category.lower().replace('_', ' ')} "
        f"issue. The complaint was classified "
        f"under {department} with "
        f"{priority.lower()} priority."
    )


def analyze_complaint(text):

    classification = classify_complaint(
        text
    )

    priority = predict_priority(
        text
    )

    sentiment = analyze_sentiment(
        text
    )

    summary = generate_summary(
        classification["category"],
        classification["department"],
        priority["priority"]
    )

    return {

        "category":
            classification["category"],

        "department":
            classification["department"],

        "classification_scores":
            classification["scores"],

        "priority":
            priority["priority"],

        "priority_score":
            priority["score"],

        "sentiment":
            sentiment,

        "summary":
            summary
    }