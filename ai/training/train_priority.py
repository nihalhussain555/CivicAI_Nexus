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
MODEL_PATH = BASE_DIR / "models" / "priority_model.pkl"


# ============================================================
# LOAD DATASET
# ============================================================

print("=" * 60)
print("CIVICAI NEXUS - PRIORITY CLASSIFIER")
print("=" * 60)

print("\nLoading dataset...")
print(f"Dataset: {DATA_PATH}")

df = pd.read_csv(DATA_PATH)


# ============================================================
# CHECK REQUIRED COLUMNS
# ============================================================

required_columns = [
    "text",
    "priority"
]

for column in required_columns:

    if column not in df.columns:

        raise ValueError(
            f"Missing required column: '{column}'"
        )


# ============================================================
# CLEAN DATA
# ============================================================

df = df.dropna(
    subset=[
        "text",
        "priority"
    ]
)

df["text"] = (
    df["text"]
    .astype(str)
    .str.strip()
)

df["priority"] = (
    df["priority"]
    .astype(str)
    .str.strip()
)


# Remove empty complaints
df = df[df["text"] != ""]


# Remove duplicates
df = df.drop_duplicates(
    subset=[
        "text",
        "priority"
    ]
)


print("\nDataset loaded successfully!")

print(
    f"Total complaints: {len(df)}"
)

print(
    f"Priority classes: "
    f"{df['priority'].nunique()}"
)


# ============================================================
# PRIORITY DISTRIBUTION
# ============================================================

print("\nPriority distribution:")
print("-" * 60)

print(
    df["priority"]
    .value_counts()
)


# ============================================================
# FEATURES AND LABELS
# ============================================================

X = df["text"]
y = df["priority"]


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
print("Testing samples:", len(X_test))


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

print("\nTraining priority classifier...")

model.fit(
    X_train,
    y_train
)

print("Training completed!")


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


print("\n" + "=" * 60)
print("MODEL PERFORMANCE")
print("=" * 60)

print(
    f"\nAccuracy: "
    f"{accuracy * 100:.2f}%"
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


print("\n" + "=" * 60)
print("MODEL SAVED")
print("=" * 60)

print(
    f"\nSaved to:\n{MODEL_PATH}"
)