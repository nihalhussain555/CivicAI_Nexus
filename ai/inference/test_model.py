from pathlib import Path
import joblib

# ============================================================
# LOAD MODEL
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent

MODEL_PATH = BASE_DIR / "models" / "complaint_classifier.pkl"

print("Loading CivicAI Department Model...")

model = joblib.load(MODEL_PATH)

print("Model loaded successfully!\n")


# ============================================================
# PREDICT FUNCTION
# ============================================================

def predict_department(text):

    probabilities = model.predict_proba([text])[0]

    classes = model.classes_

    top_indices = probabilities.argsort()[-3:][::-1]

    print("\nComplaint:")
    print(text)

    print("\nTop Predictions:")
    print("-" * 40)

    for index in top_indices:

        department = classes[index]
        confidence = probabilities[index] * 100

        print(f"{department:<35} {confidence:.2f}%")

    best = top_indices[0]

    print("-" * 40)
    print("Final Department:", classes[best])
    print(f"Confidence: {probabilities[best]*100:.2f}%")


# ============================================================
# INTERACTIVE LOOP
# ============================================================

while True:

    print("\nEnter a grievance complaint")
    print("Type 'exit' to stop.\n")

    complaint = input("Complaint: ")

    if complaint.lower() == "exit":
        print("\nExiting...")
        break

    if complaint.strip() == "":
        print("Complaint cannot be empty.")
        continue

    predict_department(complaint)