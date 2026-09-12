"""
CivicAI Nexus AI pipeline.

All department values are normalized to the canonical department list before
they are returned to the grievance service.
"""

from app.ai.provider import (
    analyze_with_fallback,
    get_ai_provider,
)

from app.config.database import grievances_collection

from app.services.classification_service import (
    normalize_department,
    classify_complaint,
)

from app.services.duplicate_service import (
    find_duplicate,
    find_similar_cases,
)

from app.services.prediction_service import (
    predict_resolution_hours,
    compute_sla_due_at,
    assess_escalation_risk,
)

from app.services.translation_service import (
    detect_language,
    translate_text,
)


def run_pipeline(
    text: str,
    language: str = "Auto",
    citizen_id=None,
    location=None,
) -> dict:

    text = (text or "").strip()

    if not text:
        raise ValueError(
            "Complaint text cannot be empty."
        )

    # ---------------------------------------------------------
    # 1. Language detection
    # ---------------------------------------------------------

    detected_language = (
        detect_language(text)
        if language in ("Auto", None)
        else language
    )

    translated_text = translate_text(
        text,
        detected_language,
        "English",
    )

    # ---------------------------------------------------------
    # 2. AI analysis
    # ---------------------------------------------------------

    analysis = analyze_with_fallback(
        translated_text,
        detected_language,
    )

    # ---------------------------------------------------------
    # 3. Department normalization
    # ---------------------------------------------------------

    predicted_department = normalize_department(
        analysis.get(
            "recommended_department"
        )
    )

    # If the LLM gives an unknown department,
    # use the deterministic local classifier.
    if not predicted_department:
        local_classification = classify_complaint(
            text
        )

        predicted_department = (
            local_classification["department"]
        )

        if not analysis.get("category"):
            analysis["category"] = (
                local_classification["category"]
            )

    # ---------------------------------------------------------
    # 4. Duplicate detection
    # ---------------------------------------------------------

    duplicate = find_duplicate(
        translated_text,
        grievances_collection,
        citizen_id=citizen_id,
        category=analysis.get(
            "category"
        ),
    )

    similar_cases = find_similar_cases(
        translated_text,
        grievances_collection,
        category=analysis.get(
            "category"
        ),
    )[:5]

    # ---------------------------------------------------------
    # 5. Resolution prediction
    # ---------------------------------------------------------

    predicted_hours = predict_resolution_hours(
        analysis.get(
            "category",
            "GENERAL",
        ),
        analysis.get(
            "severity",
            "LOW",
        ),
    )

    # ---------------------------------------------------------
    # 6. SLA
    # ---------------------------------------------------------

    sla_due_at, sla_hours = (
        compute_sla_due_at(
            analysis.get(
                "priority",
                "MEDIUM",
            )
        )
    )

    # ---------------------------------------------------------
    # 7. Escalation
    # ---------------------------------------------------------

    escalation_risk = assess_escalation_risk(
        priority=analysis.get(
            "priority",
            "LOW",
        ),
        duplicate_score=duplicate["score"],
        similar_case_count=len(
            similar_cases
        ),
        hours_since_created=0,
        sla_hours=sla_hours,
    )

    # ---------------------------------------------------------
    # 8. Final normalized result
    # ---------------------------------------------------------

    return {
        "detected_language": detected_language,

        "translated_text": translated_text,

        "category": analysis.get(
            "category",
            "GENERAL",
        ),

        "subcategory": analysis.get(
            "subcategory"
        ),

        "severity": analysis.get(
            "severity",
            "LOW",
        ),

        "urgency_score": analysis.get(
            "urgency_score",
            0,
        ),

        "priority": analysis.get(
            "priority",
            "LOW",
        ),

        "priority_score": analysis.get(
            "priority_score",
            0,
        ),

        "confidence": analysis.get(
            "confidence",
            0.5,
        ),

        "sentiment": analysis.get(
            "sentiment",
            "NEUTRAL",
        ),

        "ai_summary": analysis.get(
            "summary"
        ),

        "recommended_action": analysis.get(
            "recommended_action"
        ),

        "ai_provider": analysis.get(
            "provider",
            get_ai_provider().name,
        ),

        # ALWAYS canonical.
        "department": predicted_department,

        "duplicate": duplicate[
            "duplicate"
        ],

        "duplicate_score": duplicate[
            "score"
        ],

        "duplicate_of": duplicate[
            "match"
        ],

        "similar_cases": [
            {
                "grievance_id": case[
                    "grievance_id"
                ],
                "similarity": case[
                    "similarity"
                ],
            }
            for case in similar_cases
        ],

        "predicted_resolution_hours":
            predicted_hours,

        "escalation_risk":
            escalation_risk,

        "sla_due_at":
            sla_due_at,
    }