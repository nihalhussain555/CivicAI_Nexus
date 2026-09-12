from pathlib import Path

import joblib
import pandas as pd

from sklearn.model_selection import (
    train_test_split,
)
from sklearn.pipeline import (
    Pipeline,
    FeatureUnion,
)
from sklearn.feature_extraction.text import (
    TfidfVectorizer,
)
from sklearn.svm import LinearSVC
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
)


BASE_DIR = (
    Path(__file__)
    .resolve()
    .parent.parent
)

DATASET_PATH = (
    BASE_DIR
    / "datasets"
    / "complaints.csv"
)

MODEL_DIR = (
    BASE_DIR
    / "models"
)

MODEL_PATH = (
    MODEL_DIR
    / "complaint_classifier.pkl"
)


EXPECTED_DEPARTMENTS = [
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


print("=" * 80)
print("CIVICAI NEXUS")
print("MULTILINGUAL DEPARTMENT CLASSIFIER")
print("=" * 80)


if not DATASET_PATH.exists():
    raise FileNotFoundError(
        f"Dataset not found:\n{DATASET_PATH}"
    )


df = pd.read_csv(
    DATASET_PATH
)


required = {
    "text",
    "department",
}

missing = (
    required -
    set(df.columns)
)

if missing:
    raise ValueError(
        f"Missing columns: {missing}"
    )


df = df[
    [
        "text",
        "department",
    ]
].copy()


df["text"] = (
    df["text"]
    .fillna("")
    .astype(str)
    .str.strip()
)

df["department"] = (
    df["department"]
    .fillna("")
    .astype(str)
    .str.strip()
)


df = df[
    (df["text"] != "")
    &
    (df["department"] != "")
]


df = df.drop_duplicates(
    subset=[
        "text",
        "department",
    ]
)


actual = sorted(
    df["department"]
    .unique()
)


print(
    f"\nRows: {len(df)}"
)

print(
    f"Departments: {len(actual)}"
)


missing_departments = (
    set(
        EXPECTED_DEPARTMENTS
    )
    -
    set(actual)
)

invalid_departments = (
    set(actual)
    -
    set(
        EXPECTED_DEPARTMENTS
    )
)


if missing_departments:
    raise ValueError(
        "Missing departments:\n"
        + "\n".join(
            sorted(
                missing_departments
            )
        )
    )


if invalid_departments:
    raise ValueError(
        "Invalid departments:\n"
        + "\n".join(
            sorted(
                invalid_departments
            )
        )
    )


print("\nDataset distribution:")

print(
    df["department"]
    .value_counts()
    .sort_index()
)


X = df["text"]
y = df["department"]


X_train, X_test, y_train, y_test = (
    train_test_split(
        X,
        y,
        test_size=0.20,
        random_state=42,
        stratify=y,
    )
)


features = FeatureUnion(
    [
        (
            "word",
            TfidfVectorizer(
                analyzer="word",
                lowercase=True,
                ngram_range=(1, 3),
                sublinear_tf=True,
                min_df=1,
                max_df=0.99,
                max_features=200000,
                strip_accents="unicode",
            ),
        ),
        (
            "char",
            TfidfVectorizer(
                analyzer="char_wb",
                lowercase=True,
                ngram_range=(2, 6),
                sublinear_tf=True,
                min_df=1,
                max_features=250000,
            ),
        ),
    ]
)


candidates = [
    (
        "LinearSVC-C1",
        LinearSVC(
            C=1.0,
            class_weight="balanced",
            max_iter=20000,
            random_state=42,
        ),
    ),
    (
        "LinearSVC-C2",
        LinearSVC(
            C=2.0,
            class_weight="balanced",
            max_iter=20000,
            random_state=42,
        ),
    ),
    (
        "LinearSVC-C3",
        LinearSVC(
            C=3.0,
            class_weight="balanced",
            max_iter=20000,
            random_state=42,
        ),
    ),
]


best_name = None
best_model = None
best_accuracy = -1


for name, classifier in candidates:

    print(
        f"\nTraining candidate: {name}"
    )

    model = Pipeline(
        [
            (
                "features",
                features,
            ),
            (
                "classifier",
                classifier,
            ),
        ]
    )

    model.fit(
        X_train,
        y_train,
    )

    predictions = (
        model.predict(
            X_test
        )
    )

    accuracy = (
        accuracy_score(
            y_test,
            predictions,
        )
    )

    print(
        f"{name} accuracy: "
        f"{accuracy * 100:.2f}%"
    )

    if accuracy > best_accuracy:
        best_accuracy = accuracy
        best_name = name
        best_model = model


print("\n" + "=" * 80)
print("BEST MODEL")
print("=" * 80)

print(
    f"\nSelected: {best_name}"
)

print(
    f"Holdout accuracy: "
    f"{best_accuracy * 100:.2f}%"
)


# ------------------------------------------------------------
# FINAL EVALUATION
# ------------------------------------------------------------

predictions = (
    best_model.predict(
        X_test
    )
)


print("\nClassification Report:")

print(
    classification_report(
        y_test,
        predictions,
        labels=EXPECTED_DEPARTMENTS,
        zero_division=0,
    )
)


cm = confusion_matrix(
    y_test,
    predictions,
    labels=EXPECTED_DEPARTMENTS,
)


print("\nConfusion Matrix:")

print(
    pd.DataFrame(
        cm,
        index=EXPECTED_DEPARTMENTS,
        columns=EXPECTED_DEPARTMENTS,
    )
)


# ------------------------------------------------------------
# RETRAIN ON COMPLETE DATASET
# ------------------------------------------------------------

print(
    "\nRetraining selected model "
    "on complete dataset..."
)


final_model = Pipeline(
    [
        (
            "features",
            FeatureUnion(
                [
                    (
                        "word",
                        TfidfVectorizer(
                            analyzer="word",
                            lowercase=True,
                            ngram_range=(1, 3),
                            sublinear_tf=True,
                            min_df=1,
                            max_df=0.99,
                            max_features=200000,
                            strip_accents="unicode",
                        ),
                    ),
                    (
                        "char",
                        TfidfVectorizer(
                            analyzer="char_wb",
                            lowercase=True,
                            ngram_range=(2, 6),
                            sublinear_tf=True,
                            min_df=1,
                            max_features=250000,
                        ),
                    ),
                ]
            ),
        ),
        (
            "classifier",
            LinearSVC(
                C=float(
                    best_name.split(
                        "C"
                    )[-1]
                ),
                class_weight="balanced",
                max_iter=20000,
                random_state=42,
            ),
        ),
    ]
)


final_model.fit(
    X,
    y,
)


MODEL_DIR.mkdir(
    parents=True,
    exist_ok=True,
)


joblib.dump(
    final_model,
    MODEL_PATH,
)


print("\n" + "=" * 80)
print("MODEL SAVED")
print("=" * 80)

print(
    f"\n{MODEL_PATH}"
)

print("\nTraining completed successfully.")