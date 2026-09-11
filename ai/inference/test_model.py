from pathlib import Path
import joblib


# ============================================================
# PATH
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent

MODEL_PATH = (
    BASE_DIR /
    "models" /
    "complaint_classifier.pkl"
)


# ============================================================
# LOAD MODEL
# ============================================================

if not MODEL_PATH.exists():
    raise FileNotFoundError(
        f"Model not found:\n{MODEL_PATH}"
    )

model = joblib.load(MODEL_PATH)

print("=" * 70)
print("CIVICAI NEXUS - DEPARTMENT CLASSIFIER")
print("=" * 70)

print("\nModel loaded successfully.")


# ============================================================
# PREDICTION
# ============================================================

def predict_department(text):

    prediction = model.predict([text])[0]

    return prediction


# ============================================================
# TEST COMPLAINTS
# ============================================================

test_complaints = [

    # Tamil
    "எங்கள் பகுதியில் குடிநீர் வரவில்லை",

    # Hindi
    "हमारे इलाके में पीने का पानी नहीं आ रहा है",

    # Malayalam
    "ഞങ്ങളുടെ പ്രദേശത്ത് കുടിവെള്ളം ലഭിക്കുന്നില്ല",

    # English
    "There is no drinking water supply in my area",

    # Tanglish
    "Enga area la drinking water varala"
]


print("\n" + "=" * 70)
print("MULTILINGUAL TEST")
print("=" * 70)


for complaint in test_complaints:

    department = predict_department(
        complaint
    )

    print("\nComplaint:")
    print(complaint)

    print("\nPredicted Department:")
    print(department)

    print("-" * 70)


# ============================================================
# INTERACTIVE TEST
# ============================================================

print("\n")
print("=" * 70)
print("INTERACTIVE TEST")
print("=" * 70)

print("\nEnter a grievance complaint")
print("Type 'exit' to stop.\n")


while True:

    complaint = input("Complaint: ").strip()

    if complaint.lower() == "exit":
        print("\nTesting stopped.")
        break

    if not complaint:
        continue

    department = predict_department(
        complaint
    )

    print("\nPredicted Department:")
    print(department)

    print("-" * 70)