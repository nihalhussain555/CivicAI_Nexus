from pathlib import Path
import joblib
import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline, FeatureUnion
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import LinearSVC
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix
)


# ============================================================
# PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent

DATASET_PATH = BASE_DIR / "datasets" / "complaints.csv"
MODEL_DIR = BASE_DIR / "models"
MODEL_PATH = MODEL_DIR / "complaint_classifier.pkl"

MODEL_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================
# EXPECTED DEPARTMENTS
# ============================================================

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
    "Drainage & Sewerage"
]


# ============================================================
# LOAD DATASET
# ============================================================

print("=" * 80)
print("CIVICAI NEXUS - DEPARTMENT MODEL TRAINING")
print("=" * 80)

if not DATASET_PATH.exists():
    raise FileNotFoundError(
        f"Dataset not found:\n{DATASET_PATH}"
    )

df = pd.read_csv(DATASET_PATH)

print(f"\nDataset loaded: {DATASET_PATH}")
print(f"Total rows: {len(df)}")


# ============================================================
# COLUMN VALIDATION
# ============================================================

required_columns = {"text", "department"}

missing = required_columns - set(df.columns)

if missing:
    raise ValueError(
        f"Missing required columns: {missing}"
    )


df = df[["text", "department"]].copy()


# ============================================================
# CLEAN DATA
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

# Remove empty rows
df = df[
    (df["text"] != "") &
    (df["department"] != "")
]

# Remove exact duplicate complaints
df = df.drop_duplicates(
    subset=["text", "department"]
)

print(f"Rows after cleaning: {len(df)}")


# ============================================================
# CHECK DEPARTMENTS
# ============================================================

actual_departments = sorted(
    df["department"].unique().tolist()
)

print("\nDepartments found:")
for department in actual_departments:
    print(f"  - {department}")

# Check for invalid / old departments
invalid_departments = set(actual_departments) - set(
    EXPECTED_DEPARTMENTS
)

if invalid_departments:

    print("\nERROR: Unexpected department labels found:")

    for department in sorted(invalid_departments):
        print(f"  ❌ {department}")

    print("\nExpected only:")
    for department in EXPECTED_DEPARTMENTS:
        print(f"  ✓ {department}")

    raise ValueError(
        "\nDataset contains old or invalid department labels. "
        "Fix the dataset generator before training."
    )


# ============================================================
# CHECK ALL 21 DEPARTMENTS
# ============================================================

missing_departments = set(
    EXPECTED_DEPARTMENTS
) - set(actual_departments)

if missing_departments:

    print("\nERROR: Missing departments:")

    for department in sorted(missing_departments):
        print(f"  ❌ {department}")

    raise ValueError(
        "All 21 departments must exist in the dataset."
    )


# ============================================================
# DATASET DISTRIBUTION
# ============================================================

print("\n" + "=" * 80)
print("DATASET DISTRIBUTION")
print("=" * 80)

distribution = (
    df["department"]
    .value_counts()
    .sort_index()
)

for department, count in distribution.items():
    print(f"{department:<35} {count}")


# ============================================================
# LANGUAGE-AGNOSTIC TEXT FEATURES
# ============================================================

X = df["text"]
y = df["department"]


# ============================================================
# TRAIN / TEST SPLIT
# ============================================================

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42,
    stratify=y
)

print("\nTraining samples:", len(X_train))
print("Testing samples :", len(X_test))


# ============================================================
# MULTILINGUAL FEATURE ENGINEERING
# ============================================================

word_features = TfidfVectorizer(
    analyzer="word",

    lowercase=True,

    ngram_range=(1, 2),

    sublinear_tf=True,

    min_df=1,

    max_df=0.98,

    max_features=100000,

    strip_accents="unicode"
)


char_features = TfidfVectorizer(
    analyzer="char",

    ngram_range=(2, 5),

    min_df=1,

    max_df=0.99,

    max_features=150000,

    sublinear_tf=True
)


features = FeatureUnion([
    ("word_tfidf", word_features),
    ("char_tfidf", char_features)
])


# ============================================================
# CLASSIFIER
# ============================================================

classifier = LinearSVC(
    C=2.0,
    class_weight="balanced",
    max_iter=10000,
    random_state=42
)


# ============================================================
# COMPLETE PIPELINE
# ============================================================

model = Pipeline([
    ("features", features),
    ("classifier", classifier)
])


# ============================================================
# TRAIN
# ============================================================

print("\n" + "=" * 80)
print("TRAINING MODEL")
print("=" * 80)

model.fit(
    X_train,
    y_train
)

print("Training completed.")


# ============================================================
# EVALUATION
# ============================================================

print("\n" + "=" * 80)
print("MODEL EVALUATION")
print("=" * 80)

predictions = model.predict(X_test)

accuracy = accuracy_score(
    y_test,
    predictions
)

print(
    f"\nOverall Accuracy: "
    f"{accuracy * 100:.2f}%"
)


# ============================================================
# CLASSIFICATION REPORT
# ============================================================

print("\nClassification Report:\n")

print(
    classification_report(
        y_test,
        predictions,
        labels=EXPECTED_DEPARTMENTS,
        zero_division=0
    )
)


# ============================================================
# CONFUSION MATRIX
# ============================================================

cm = confusion_matrix(
    y_test,
    predictions,
    labels=EXPECTED_DEPARTMENTS
)

print("\n" + "=" * 80)
print("CONFUSION MATRIX")
print("=" * 80)

print(
    "\nRows = Actual Department"
    "\nColumns = Predicted Department\n"
)

print(
    pd.DataFrame(
        cm,
        index=EXPECTED_DEPARTMENTS,
        columns=EXPECTED_DEPARTMENTS
    )
)


# ============================================================
# SAVE MODEL
# ============================================================

joblib.dump(
    model,
    MODEL_PATH
)

print("\n" + "=" * 80)
print("MODEL SAVED")
print("=" * 80)

print(
    f"\nModel path:\n{MODEL_PATH}"
)

print("\nTraining finished successfully.")