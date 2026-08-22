"""
Orchestrates the full grievance AI pipeline described in the spec:

  input -> language detect/translate -> (speech / image handled upstream)
  -> classification -> severity -> urgency -> priority
  -> duplicate / similar-case detection -> community incident clustering
  -> department recommendation -> resolution-time prediction
  -> escalation/SLA risk -> officer summary / recommended action

Every value in the returned dict is explicitly AI-generated and must be
labeled as such by the API layer / frontend — this module never claims a
prediction is a guaranteed fact.
"""

from app.ai.provider import analyze_with_fallback, get_ai_provider
from app.config.database import grievances_collection
from app.services.duplicate_service import find_duplicate, find_similar_cases
from app.services.prediction_service import (
    predict_resolution_hours,
    compute_sla_due_at,
    assess_escalation_risk,
)
from app.services.translation_service import detect_language, translate_text


def run_pipeline(text: str, language: str = "Auto", citizen_id=None, location=None) -> dict:
    """
    Runs everything that can happen *before* a grievance is persisted
    (i.e. everything except incident clustering, which needs a saved
    grievance_id and is triggered separately once the record exists).
    """
    text = text.strip()

    # 1. language detection / translation
    detected_language = detect_language(text) if language in ("Auto", None) else language
    translated_text = translate_text(text, detected_language, "English")

    # 2/3/4. classification, severity, urgency, priority, sentiment, summary
    analysis = analyze_with_fallback(translated_text, detected_language)

    # 5. duplicate detection (same citizen) + similar-case ranking (community)
    duplicate = find_duplicate(
        translated_text, grievances_collection, citizen_id=citizen_id,
        category=analysis.get("category"),
    )
    similar_cases = find_similar_cases(
        translated_text, grievances_collection, category=analysis.get("category"),
    )[:5]

    # 6. resolution-time prediction
    predicted_hours = predict_resolution_hours(
        analysis.get("category", "GENERAL"), analysis.get("severity", "LOW"),
    )

    # 7. SLA due date + escalation risk
    sla_due_at, sla_hours = compute_sla_due_at(analysis.get("priority", "MEDIUM"))
    escalation_risk = assess_escalation_risk(
        priority=analysis.get("priority", "LOW"),
        duplicate_score=duplicate["score"],
        similar_case_count=len(similar_cases),
        hours_since_created=0,
        sla_hours=sla_hours,
    )

    return {
        "detected_language": detected_language,
        "translated_text": translated_text,

        "category": analysis.get("category", "GENERAL"),
        "subcategory": analysis.get("subcategory"),
        "severity": analysis.get("severity", "LOW"),
        "urgency_score": analysis.get("urgency_score", 0),
        "priority": analysis.get("priority", "LOW"),
        "priority_score": analysis.get("priority_score", 0),
        "confidence": analysis.get("confidence", 0.5),
        "sentiment": analysis.get("sentiment", "NEUTRAL"),
        "ai_summary": analysis.get("summary"),
        "recommended_action": analysis.get("recommended_action"),
        "ai_provider": analysis.get("provider", get_ai_provider().name),

        "department": analysis.get("recommended_department", "General Administration"),

        "duplicate": duplicate["duplicate"],
        "duplicate_score": duplicate["score"],
        "duplicate_of": duplicate["match"],
        "similar_cases": [
            {"grievance_id": c["grievance_id"], "similarity": c["similarity"]}
            for c in similar_cases
        ],

        "predicted_resolution_hours": predicted_hours,
        "escalation_risk": escalation_risk,
        "sla_due_at": sla_due_at,
    }
