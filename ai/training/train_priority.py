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
from sklearn.linear_model import LogisticRegression

from sklearn.metrics import (
    accuracy_score,
    classification_report,
)


BASE_DIR = (
    Path(__file__)
    .resolve()
    .parent.parent
)

DATA_PATH = (
    BASE_DIR
    / "datasets"
    / "complaints.csv"
)

MODEL_PATH = (
    BASE_DIR
    / "models"
    / "priority_model.pkl"
)


print("=" * 80)
print("CIVICAI NEXUS")
print("PRIORITY CLASSIFIER")
print("=" * 80)


df = pd.read_csv(
    DATA_PATH
)


required = {
    "text",
    "priority",
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
        "priority",
    ]
].dropna()


df["text"] = (
    df["text"]
    .astype(str)
    .str.strip()
)

df["priority"] = (
    df["priority"]
    .astype(str)
    .str.upper()
    .str.strip()
)


allowed = {
    "LOW",
    "MEDIUM",
    "HIGH",
    "CRITICAL",
}


df = df[
    df["priority"]
    .isin(allowed)
]


df = df.drop_duplicates(
    subset=[
        "text",
        "priority",
    ]
)


print(
    f"\nRows: {len(df)}"
)

print(
    df["priority"]
    .value_counts()
)


X = df["text"]
y = df["priority"]


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
                ngram_range=(1, 3),
                sublinear_tf=True,
                min_df=1,
                max_df=0.99,
                max_features=100000,
                strip_accents="unicode",
            ),
        ),
        (
            "char",
            TfidfVectorizer(
                analyzer="char_wb",
                ngram_range=(2, 6),
                sublinear_tf=True,
                min_df=1,
                max_features=150000,
            ),
        ),
    ]
)


model = Pipeline(
    [
        (
            "features",
            features,
        ),
        (
            "classifier",
            LogisticRegression(
                C=2.0,
                max_iter=5000,
                class_weight="balanced",
                random_state=42,
            ),
        ),
    ]
)


print(
    "\nTraining..."
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
    f"\nAccuracy: "
    f"{accuracy * 100:.2f}%"
)


print(
    "\nClassification report:"
)


print(
    classification_report(
        y_test,
        predictions,
        zero_division=0,
    )
)


MODEL_PATH.parent.mkdir(
    parents=True,
    exist_ok=True,
)


# Retrain using complete dataset
model.fit(
    X,
    y,
)


joblib.dump(
    model,
    MODEL_PATH,
)


print(
    "\nPriority model saved:"
)

print(
    MODEL_PATH
)