"""
Train the CivicAI Nexus multilingual department classifier.

The trained model ALWAYS uses the canonical department names.

Dataset:
    ai/datasets/complaints.csv

Output:
    ai/models/complaint_classifier.pkl
"""

from pathlib import Path

import joblib
import pandas as pd

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import Pipeline, FeatureUnion
from sklearn.svm import LinearSVC
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    classification_report,
)


# ============================================================
# PATHS
# ============================================================

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


# ============================================================
# CANONICAL DEPARTMENTS
# ============================================================

EXPECTED_DEPARTMENTS = [
    "Municipal Corporation",
    "Police",
    "Health",
    "Education",
    "Electricity",
    "Water Supply",
    "Roads & Highways",
    "Sanitation & Waste Management",
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


# ============================================================
# OLD LABEL MIGRATION
# ============================================================

DEPARTMENT_ALIASES = {
    "Water Services":
        "Water Supply",

    "Water Supply Department":
        "Water Supply",

    "Water and Sanitation Department":
        "Water Supply",

    "Waste Management":
        "Sanitation & Waste Management",

    "Sanitation Department":
        "Sanitation & Waste Management",

    "Public Works Department":
        "Public Works",

    "Traffic Police Department":
        "Police",

    "Police Department":
        "Police",

    "Electricity Department":
        "Electricity",

    "Health Department":
        "Health",

    "Education Department":
        "Education",

    "Agriculture Department":
        "Agriculture",

    "Housing Department":
        "Housing",

    "Revenue Department":
        "Revenue & Land Records",

    "Land Records Department":
        "Revenue & Land Records",

    "Food Department":
        "Food & Civil Supplies",

    "Civil Supplies Department":
        "Food & Civil Supplies",

    "Transport Department":
        "Transport",

    "Labour Department":
        "Labour & Employment",

    "Employment Department":
        "Labour & Employment",

    "Women and Child Welfare Department":
        "Women & Child Welfare",

    "Environment Department":
        "Environment & Forest",

    "Forest Department":
        "Environment & Forest",

    "Social Welfare Department":
        "Social Welfare",

    "Rural Development Department":
        "Rural Development / Panchayat",

    "Panchayat Department":
        "Rural Development / Panchayat",

    "E-Governance":
        "e-Governance",

    "E-Governance Department":
        "e-Governance",

    "Drainage Department":
        "Drainage & Sewerage",

    "Sewerage Department":
        "Drainage & Sewerage",
}


# ============================================================
# HEADER
# ============================================================

print("=" * 80)
print("CIVICAI NEXUS")
print("MULTILINGUAL DEPARTMENT CLASSIFIER")
print("=" * 80)


# ============================================================
# CHECK DATASET
# ============================================================

if not DATASET_PATH.exists():
    raise FileNotFoundError(
        f"Dataset not found:\n{DATASET_PATH}"
    )


# ============================================================
# LOAD DATASET
# ============================================================

df = pd.read_csv(
    DATASET_PATH
)


required_columns = {
    "text",
    "department",
}

missing_columns = (
    required_columns
    - set(df.columns)
)

if missing_columns:
    raise ValueError(
        "Dataset is missing columns: "
        + ", ".join(
            sorted(
                missing_columns
            )
        )
    )


df = df[
    [
        "text",
        "department",
    ]
].copy()


# ============================================================
# CLEAN TEXT
# ============================================================

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


# ============================================================
# NORMALIZE OLD DEPARTMENT LABELS
# ============================================================

df["department"] = df[
    "department"
].apply(
    lambda value:
        DEPARTMENT_ALIASES.get(
            value,
            value,
        )
)


# ============================================================
# REMOVE DUPLICATES
# ============================================================

df = df.drop_duplicates(
    subset=[
        "text",
        "department",
    ]
).reset_index(
    drop=True
)


# ============================================================
# VALIDATE DEPARTMENTS
# ============================================================

actual_departments = sorted(
    df["department"]
    .unique()
)


missing_departments = (
    set(EXPECTED_DEPARTMENTS)
    -
    set(actual_departments)
)


invalid_departments = (
    set(actual_departments)
    -
    set(EXPECTED_DEPARTMENTS)
)


if missing_departments:

    raise ValueError(
        "Dataset is missing these departments:\n"
        +
        "\n".join(
            sorted(
                missing_departments
            )
        )
    )


if invalid_departments:

    raise ValueError(
        "Dataset contains invalid departments:\n"
        +
        "\n".join(
            sorted(
                invalid_departments
            )
        )
    )


# ============================================================
# DATASET INFORMATION
# ============================================================

print()
print(
    f"Dataset rows: {len(df)}"
)

print(
    f"Departments: {len(actual_departments)}"
)

print()
print(
    "Department distribution:"
)

print(
    df["department"]
    .value_counts()
    .sort_index()
)


# ============================================================
# FEATURES
# ============================================================

X = df["text"]

y = df["department"]


# ============================================================
# TRAIN / TEST SPLIT
# ============================================================

X_train, X_test, y_train, y_test = (
    train_test_split(
        X,
        y,
        test_size=0.20,
        random_state=42,
        stratify=y,
    )
)


# ============================================================
# FEATURE ENGINEERING
# ============================================================
#
# Word features:
#   useful for phrases and domain vocabulary
#
# Character features:
#   especially useful for Tamil/Hindi/Malayalam and
#   spelling variations.
# ============================================================

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


# ============================================================
# MODEL
# ============================================================

model = Pipeline(
    [
        (
            "features",
            features,
        ),

        (
            "classifier",
            LinearSVC(
                C=2.0,
                class_weight="balanced",
                max_iter=30000,
                random_state=42,
            ),
        ),
    ]
)


# ============================================================
# TRAIN
# ============================================================

print()
print(
    "Training model..."
)

model.fit(
    X_train,
    y_train,
)


# ============================================================
# EVALUATION
# ============================================================

predictions = model.predict(
    X_test
)


accuracy = accuracy_score(
    y_test,
    predictions,
)


print()
print("=" * 80)
print("MODEL EVALUATION")
print("=" * 80)

print(
    f"\nHoldout accuracy: "
    f"{accuracy * 100:.2f}%"
)


print()
print(
    classification_report(
        y_test,
        predictions,
        labels=EXPECTED_DEPARTMENTS,
        zero_division=0,
    )
)


# ============================================================
# FINAL TRAINING ON COMPLETE DATASET
# ============================================================

print()
print(
    "Training final model on complete dataset..."
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
                C=2.0,
                class_weight="balanced",
                max_iter=30000,
                random_state=42,
            ),
        ),
    ]
)

final_model.fit( X, y,)

# ============================================================
# SAVE
# ============================================================

MODEL_DIR.mkdir( parents=True, exist_ok=True,)

joblib.dump( final_model,MODEL_PATH,)

print()
print("=" * 80)
print("MODEL SAVED")
print("=" * 80)

print()
print(MODEL_PATH)

print()
print("Training completed successfully.")