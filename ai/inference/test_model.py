from pathlib import Path

import joblib


BASE_DIR = (
    Path(__file__)
    .resolve()
    .parent.parent
)

MODEL_PATH = (
    BASE_DIR
    / "models"
    / "complaint_classifier.pkl"
)


if not MODEL_PATH.exists():
    raise FileNotFoundError(
        f"Model not found:\n{MODEL_PATH}\n\n"
        "Run train_classifier.py first."
    )


model = joblib.load(
    MODEL_PATH
)


def predict(text):
    prediction = (
        model.predict(
            [text]
        )[0]
    )

    confidence = None
    alternatives = []

    if hasattr(
        model,
        "decision_function",
    ):
        scores = (
            model.decision_function(
                [text]
            )[0]
        )

        classes = (
            model.classes_
        )

        ranked = sorted(
            zip(
                classes,
                scores,
            ),
            key=lambda item:
                item[1],
            reverse=True,
        )

        alternatives = [
            {
                "department":
                    department,
                "score":
                    round(
                        float(score),
                        4,
                    ),
            }
            for department, score
            in ranked[:5]
        ]

        confidence = round(
            1 /
            (
                1 +
                __import__(
                    "math"
                ).exp(
                    -float(
                        ranked[0][1]
                    )
                )
            ),
            4,
        )

    return (
        prediction,
        confidence,
        alternatives,
    )


TEST_COMPLAINTS = [
    # Tamil
    "எங்கள் பகுதியில் குடிநீர் வரவில்லை",

    # Hindi
    "हमारे इलाके में पीने का पानी नहीं आ रहा है",

    # Malayalam
    "ഞങ്ങളുടെ പ്രദേശത്ത് കുടിവെള്ളം ലഭിക്കുന്നില്ല",

    # English
    "There is no drinking water supply in my area",

    # Tanglish
    "Enga area la drinking water varala",

    # Road
    "There is a huge pothole on the main road",

    # Electricity
    "There has been no electricity since yesterday",

    # Police
    "My vehicle was stolen and I need police help",

    # Waste
    "Garbage has not been collected from our street",

    # Drainage
    "The sewage drain near my house is blocked",

    # Education
    "My government scholarship has not been credited",

    # Health
    "The government hospital has no essential medicines",
]


print("=" * 80)
print("CIVICAI NEXUS")
print("DEPARTMENT MODEL TEST")
print("=" * 80)


for index, complaint in enumerate(
    TEST_COMPLAINTS,
    start=1,
):

    department, confidence, alternatives = (
        predict(
            complaint
        )
    )

    print(
        f"\n[{index}] Complaint:"
    )

    print(
        complaint
    )

    print(
        "\nPredicted:"
    )

    print(
        department
    )

    print(
        "Confidence:",
        confidence,
    )

    print(
        "\nTop alternatives:"
    )

    for item in alternatives:
        print(
            f"  {item['department']}: "
            f"{item['score']}"
        )

    print(
        "-" * 80
    )


print(
    "\nInteractive testing"
)

print(
    "Type 'exit' to stop."
)


while True:

    text = input(
        "\nComplaint: "
    ).strip()

    if text.lower() == "exit":
        break

    if not text:
        continue

    department, confidence, alternatives = (
        predict(text)
    )

    print(
        "\nDepartment:",
        department,
    )

    print(
        "Confidence:",
        confidence,
    )

    print(
        "\nTop predictions:"
    )

    for item in alternatives:
        print(
            f"  {item['department']}: "
            f"{item['score']}"
        )