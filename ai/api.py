from pathlib import Path

import joblib
from flask import Flask, request, jsonify
from flask_cors import CORS


# ============================================================
# FLASK APP
# ============================================================

app = Flask(__name__)
CORS(app)


# ============================================================
# PATHS
# ============================================================

# This points to:
# CivicAI_Nexus/ai/

AI_DIR = Path(__file__).resolve().parent

DEPARTMENT_MODEL_PATH = (
    AI_DIR / "models" / "complaint_classifier.pkl"
)

PRIORITY_MODEL_PATH = (
    AI_DIR / "models" / "priority_model.pkl"
)


# ============================================================
# LOAD DEPARTMENT MODEL
# ============================================================

print("=" * 60)
print("CIVICAI NEXUS - AI API")
print("=" * 60)

print("\nLoading CivicAI Department Model...")

department_model = joblib.load(
    DEPARTMENT_MODEL_PATH
)

print("Department model loaded successfully!")


# ============================================================
# LOAD PRIORITY MODEL
# ============================================================

print("\nLoading CivicAI Priority Model...")

if PRIORITY_MODEL_PATH.exists():

    priority_model = joblib.load(
        PRIORITY_MODEL_PATH
    )

    print("Priority model loaded successfully!")

else:

    priority_model = None

    print(
        "WARNING: priority_model.pkl not found!"
    )


# ============================================================
# HEALTH CHECK
# ============================================================

@app.route("/health", methods=["GET"])
def health():

    return jsonify({
        "success": True,
        "service": "CivicAI Nexus AI",
        "status": "running",
        "department_model": True,
        "priority_model": priority_model is not None
    })


# ============================================================
# PREDICT
# ============================================================

@app.route("/predict", methods=["POST"])
def predict():

    try:

        # Get JSON
        data = request.get_json()

        # Check request
        if not data:

            return jsonify({
                "success": False,
                "error": "Request body is required"
            }), 400


        # Get complaint
        complaint = data.get("text", "").strip()


        # Empty complaint
        if not complaint:

            return jsonify({
                "success": False,
                "error": "Complaint text is required"
            }), 400


        # ====================================================
        # DEPARTMENT PREDICTION
        # ====================================================

        probabilities = (
            department_model
            .predict_proba([complaint])[0]
        )

        classes = (
            department_model.classes_
        )


        # Top 3 predictions

        top_indices = (
            probabilities
            .argsort()[-3:][::-1]
        )


        top_predictions = []

        for index in top_indices:

            top_predictions.append({

                "department":
                    str(classes[index]),

                "confidence":
                    round(
                        float(
                            probabilities[index] * 100
                        ),
                        2
                    )
            })


        # Best department

        best_index = top_indices[0]

        department = str(
            classes[best_index]
        )

        department_confidence = round(

            float(
                probabilities[best_index] * 100
            ),

            2
        )


        # ====================================================
        # PRIORITY PREDICTION
        # ====================================================

        priority = None
        priority_confidence = None


        if priority_model is not None:

            priority = str(
                priority_model.predict(
                    [complaint]
                )[0]
            )


            # Check whether model supports probabilities

            if hasattr(
                priority_model,
                "predict_proba"
            ):

                priority_probabilities = (
                    priority_model
                    .predict_proba([complaint])[0]
                )

                priority_classes = (
                    priority_model.classes_
                )

                priority_index = list(
                    priority_classes
                ).index(priority)


                priority_confidence = round(

                    float(
                        priority_probabilities[
                            priority_index
                        ] * 100
                    ),

                    2
                )


        # ====================================================
        # RESPONSE
        # ====================================================

        return jsonify({

            "success": True,

            "complaint": complaint,

            "department": department,

            "department_confidence":
                department_confidence,

            "top_predictions":
                top_predictions,

            "priority": priority,

            "priority_confidence":
                priority_confidence

        })


    except Exception as error:

        print("\nAI ERROR:")
        print(error)

        return jsonify({

            "success": False,

            "error": str(error)

        }), 500


# ============================================================
# START SERVER
# ============================================================

if __name__ == "__main__":

    print("\n" + "=" * 60)
    print("AI SERVER STARTING")
    print("=" * 60)
    print("URL: http://127.0.0.1:5001")
    print("Health: http://127.0.0.1:5001/health")
    print("Prediction: POST http://127.0.0.1:5001/predict")
    print("=" * 60)

    app.run(
        host="127.0.0.1",
        port=5001,
        debug=True
    )