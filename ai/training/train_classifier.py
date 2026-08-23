from pathlib import Path
import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report


# ============================================================
# PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent

DATA_PATH = BASE_DIR / "datasets" / "complaints.csv"
MODEL_PATH = BASE_DIR / "models" / "complaint_classifier.pkl"


print("=" * 70)
print("CIVICAI NEXUS - DEPARTMENT CLASSIFIER")
print("=" * 70)

print("\nLoading dataset...")
print(f"Dataset: {DATA_PATH}")


# ============================================================
# LOAD DATASET
# ============================================================

df = pd.read_csv(DATA_PATH)

print("\nColumns found in CSV:")
print(list(df.columns))


# ============================================================
# AUTOMATICALLY FIND COMPLAINT COLUMN
# ============================================================

text_column_candidates = [
    "text",
    "complaint",
    "complaint_text",
    "grievance",
    "grievance_text",
    "description",
    "complaint_description",
    "issue",
    "message"
]

text_column = None

for column in text_column_candidates:

    if column in df.columns:
        text_column = column
        break


if text_column is None:

    raise ValueError(
        "\nCould not find complaint text column.\n\n"
        f"Available columns: {list(df.columns)}\n\n"
        "Expected one of:\n"
        "text, complaint, complaint_text, grievance, "
        "grievance_text, description, issue, message"
    )


# ============================================================
# FIND DEPARTMENT COLUMN
# ============================================================

department_column_candidates = [
    "department",
    "department_name",
    "dept",
    "category",
    "department_category"
]

department_column = None

for column in department_column_candidates:

    if column in df.columns:
        department_column = column
        break


if department_column is None:

    raise ValueError(
        "\nCould not find department column.\n\n"
        f"Available columns: {list(df.columns)}"
    )


print("\nDetected columns:")
print(f"Complaint : {text_column}")
print(f"Department: {department_column}")


# ============================================================
# RENAME TO STANDARD NAMES
# ============================================================

df = df.rename(
    columns={
        text_column: "text",
        department_column: "department"
    }
)


# ============================================================
# CLEAN DATA
# ============================================================

df = df.dropna(
    subset=[
        "text",
        "department"
    ]
)

df["text"] = (
    df["text"]
    .astype(str)
    .str.strip()
)

df["department"] = (
    df["department"]
    .astype(str)
    .str.strip()
)


# Remove empty rows
df = df[df["text"] != ""]
df = df[df["department"] != ""]


# Remove duplicate complaints
df = df.drop_duplicates(
    subset=["text", "department"]
)


# ============================================================
# DATASET INFORMATION
# ============================================================

print("\n" + "=" * 70)
print("DATASET INFORMATION")
print("=" * 70)

print(f"\nTotal complaints: {len(df)}")

print(
    f"Departments: "
    f"{df['department'].nunique()}"
)

print("\nDepartment distribution:")
print("-" * 70)

print(
    df["department"]
    .value_counts()
)


# ============================================================
# FEATURES / LABELS
# ============================================================

X = df["text"]
y = df["department"]


# ============================================================
# TRAIN / TEST SPLIT
# ============================================================

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.40,
    random_state=42,
    stratify=y
)

print("\nTraining samples:", len(X_train))
print("Testing samples :", len(X_test))


# ============================================================
# MODEL
# ============================================================

model = Pipeline([

    (
        "tfidf",

        TfidfVectorizer(

            lowercase=True,

            ngram_range=(1, 2),

            sublinear_tf=True,

            min_df=1,

            max_df=0.95,

            strip_accents="unicode"
        )
    ),

    (
        "classifier",

        LogisticRegression(

            max_iter=3000,

            class_weight="balanced"
        )
    )
])


# ============================================================
# TRAIN
# ============================================================

print("\n" + "=" * 70)
print("TRAINING DEPARTMENT CLASSIFIER")
print("=" * 70)

model.fit(
    X_train,
    y_train
)

print("\nTraining completed!")


# ============================================================
# EVALUATION
# ============================================================

predictions = model.predict(
    X_test
)

accuracy = accuracy_score(
    y_test,
    predictions
)


print("\n" + "=" * 70)
print("MODEL PERFORMANCE")
print("=" * 70)

print(
    f"\nAccuracy: {accuracy * 100:.2f}%"
)

print("\nClassification Report:")

print(
    classification_report(
        y_test,
        predictions,
        zero_division=0
    )
)


# ============================================================
# SAVE MODEL
# ============================================================

MODEL_PATH.parent.mkdir(
    parents=True,
    exist_ok=True
)

joblib.dump(
    model,
    MODEL_PATH
)


print("\n" + "=" * 70)
print("MODEL SAVED SUCCESSFULLY")
print("=" * 70)

print(f"\nModel: {MODEL_PATH}")