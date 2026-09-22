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

from app.services.incident_service import (
    preview_matching_incident,
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
    # 3. Department normalization + ensemble cross-check
    # ---------------------------------------------------------
    # The LLM can confidently return a WRONG but still valid canonical
    # department name (e.g. "Municipal Corporation" for a water outage) —
    # that's syntactically fine, so normalize_department() alone can't
    # catch it. Cross-check against the deterministic local keyword
    # classifier (run on the ORIGINAL text so native-script Tamil/Hindi
    # keywords and direct-phrase rules still match, regardless of
    # translation quality). A strong local match (a direct-phrase hit,
    # score >= 100) overrides the LLM; any other disagreement just lowers
    # reported confidence rather than silently trusting either signal.

    predicted_department = normalize_department(
        analysis.get(
            "recommended_department"
        )
    )

    local_classification = classify_complaint(text)
    local_department = local_classification["department"]
    local_score = local_classification["scores"].get(local_department, 0)
    STRONG_LOCAL_MATCH = 100  # direct_rules hits add +100; ordinary keyword hits are 1-10

    if not predicted_department:
        # LLM gave nothing usable — fall back entirely to the local classifier.
        predicted_department = local_department
        if not analysis.get("category"):
            analysis["category"] = local_classification["category"]
        analysis["confidence"] = local_classification["confidence"]
        analysis["reason"] = analysis.get("reason") or (
            f"AI provider did not return a usable department; matched local keyword "
            f"rules for {local_department} instead."
        )

    elif local_score >= STRONG_LOCAL_MATCH and predicted_department != local_department:
        # LLM and a strong, unambiguous local phrase match disagree —
        # trust the deterministic match over the LLM's guess.
        analysis["reason"] = (
            f"Overridden: complaint text strongly and unambiguously matches "
            f"{local_department} (AI had suggested {predicted_department})."
        )
        predicted_department = local_department
        analysis["confidence"] = max(analysis.get("confidence", 0.5), 0.85)

    elif predicted_department != local_department:
        # Ordinary disagreement (weak/no local signal either way) — keep
        # the LLM's department, but don't overstate confidence.
        analysis["confidence"] = min(analysis.get("confidence", 0.5), 0.6)

    final_confidence = analysis.get("confidence", 0.5)

    # < 50% confidence: still auto-route so the pipeline never stalls, but
    # flag it clearly for admin/staff review instead of pretending we're sure.
    needs_department_review = final_confidence < 0.5

    # ---------------------------------------------------------
    # 3b. Possible related incident (read-only preview)
    # ---------------------------------------------------------

    possible_related_incident = None
    if location:
        possible_related_incident = preview_matching_incident(
            analysis.get("category", "GENERAL"), location
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

        "needs_department_review": needs_department_review,

        "ai_reason": analysis.get(
            "reason"
        ),

        "possible_related_incident": possible_related_incident,

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