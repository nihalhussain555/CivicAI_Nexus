"""
CivicAI Nexus - Prediction and SLA Services

This module contains deterministic prediction helpers used by the grievance
AI pipeline.

Important:
- No external API is required.
- Functions are intentionally kept independent from MongoDB.
- This file must remain import-safe because it is imported during FastAPI
  startup.
"""

from datetime import datetime, timedelta
from typing import Optional, Tuple

from app.config.settings import settings


# ============================================================================
# RESOLUTION-TIME BASELINES
# ============================================================================

BASE_RESOLUTION_HOURS = {
    "WASTE": 48,
    "WATER": 36,
    "ROAD": 96,
    "ELECTRICITY": 12,
    "STREET_LIGHT": 72,
    "DRAINAGE": 60,
    "TRAFFIC": 48,
    "PUBLIC_SAFETY": 8,
    "GENERAL": 72,
}


# ============================================================================
# SEVERITY MULTIPLIERS
# ============================================================================

SEVERITY_MULTIPLIER = {
    "CRITICAL": 0.35,
    "HIGH": 0.60,
    "MEDIUM": 1.00,
    "LOW": 1.30,
}


# ============================================================================
# SLA HOURS
# ============================================================================

def _get_setting(name: str, default: int) -> int:
    """
    Safely read an SLA value from the application settings.

    This prevents startup failures if an older settings file does not contain
    one of the newer SLA configuration values.
    """
    value = getattr(settings, name, default)

    try:
        return int(value)
    except (TypeError, ValueError):
        return default


SLA_HOURS_BY_PRIORITY = {
    "CRITICAL": lambda: _get_setting("SLA_HOURS_CRITICAL", 6),
    "HIGH": lambda: _get_setting("SLA_HOURS_HIGH", 24),
    "MEDIUM": lambda: _get_setting("SLA_HOURS_MEDIUM", 72),
    "LOW": lambda: _get_setting("SLA_HOURS_LOW", 168),
}


# ============================================================================
# RESOLUTION TIME PREDICTION
# ============================================================================

def predict_resolution_hours(
    category: Optional[str],
    severity: Optional[str],
    is_incident: bool = False,
) -> int:
    """
    Predict approximate resolution time in hours.

    This is currently a deterministic baseline model. It can later be replaced
    by a trained regression model without changing the AI pipeline API.

    Args:
        category:
            Internal AI category such as WATER, ROAD, ELECTRICITY.

        severity:
            LOW, MEDIUM, HIGH, or CRITICAL.

        is_incident:
            Whether the grievance belongs to a clustered community incident.

    Returns:
        Integer number of predicted hours.
    """

    category = (category or "GENERAL").upper().strip()
    severity = (severity or "MEDIUM").upper().strip()

    base_hours = BASE_RESOLUTION_HOURS.get(
        category,
        BASE_RESOLUTION_HOURS["GENERAL"],
    )

    multiplier = SEVERITY_MULTIPLIER.get(
        severity,
        SEVERITY_MULTIPLIER["MEDIUM"],
    )

    predicted = base_hours * multiplier

    # Community incidents are normally prioritized because multiple citizens
    # are affected.
    if is_incident:
        predicted *= 0.80

    return max(2, int(round(predicted)))


# ============================================================================
# SLA CALCULATION
# ============================================================================

def compute_sla_due_at(
    priority: Optional[str],
    created_at: Optional[datetime] = None,
) -> Tuple[datetime, int]:
    """
    Calculate the SLA deadline.

    Returns:
        (due_datetime, sla_hours)
    """

    priority = (priority or "MEDIUM").upper().strip()

    created_at = created_at or datetime.utcnow()

    resolver = SLA_HOURS_BY_PRIORITY.get(
        priority,
        SLA_HOURS_BY_PRIORITY["MEDIUM"],
    )

    sla_hours = resolver()

    due_at = created_at + timedelta(hours=sla_hours)

    return due_at, sla_hours


# ============================================================================
# ESCALATION RISK
# ============================================================================

def assess_escalation_risk(
    priority: Optional[str],
    duplicate_score: float = 0.0,
    similar_case_count: int = 0,
    hours_since_created: float = 0.0,
    sla_hours: int = 72,
) -> str:
    """
    Estimate escalation risk using transparent deterministic rules.

    This is deliberately explainable rather than pretending to be a trained
    black-box model.
    """

    priority = (priority or "LOW").upper().strip()

    duplicate_score = max(
        0.0,
        min(float(duplicate_score or 0), 100.0),
    )

    similar_case_count = max(
        0,
        int(similar_case_count or 0),
    )

    hours_since_created = max(
        0.0,
        float(hours_since_created or 0),
    )

    sla_hours = max(
        1,
        int(sla_hours or 72),
    )

    score = 0

    # Priority contribution
    if priority == "CRITICAL":
        score += 3
    elif priority == "HIGH":
        score += 2
    elif priority == "MEDIUM":
        score += 1

    # Community pressure
    if similar_case_count >= 10:
        score += 3
    elif similar_case_count >= 5:
        score += 2
    elif similar_case_count >= 2:
        score += 1

    # Duplicate pressure
    if duplicate_score >= 85:
        score += 2
    elif duplicate_score >= 70:
        score += 1

    # SLA pressure
    elapsed_ratio = hours_since_created / sla_hours

    if elapsed_ratio >= 1.0:
        score += 4
    elif elapsed_ratio >= 0.75:
        score += 2
    elif elapsed_ratio >= 0.50:
        score += 1

    if score >= 7:
        return "CRITICAL"

    if score >= 5:
        return "HIGH"

    if score >= 2:
        return "MEDIUM"

    return "LOW"


# ============================================================================
# OPTIONAL EXPLANATION HELPER
# ============================================================================

def get_resolution_prediction_explanation(
    category: Optional[str],
    severity: Optional[str],
    is_incident: bool = False,
) -> dict:
    """
    Return both the prediction and the factors used.

    Useful for displaying transparent AI reasoning in the admin dashboard.
    """

    category = (category or "GENERAL").upper().strip()
    severity = (severity or "MEDIUM").upper().strip()

    base_hours = BASE_RESOLUTION_HOURS.get(
        category,
        BASE_RESOLUTION_HOURS["GENERAL"],
    )

    multiplier = SEVERITY_MULTIPLIER.get(
        severity,
        SEVERITY_MULTIPLIER["MEDIUM"],
    )

    predicted_hours = predict_resolution_hours(
        category=category,
        severity=severity,
        is_incident=is_incident,
    )

    return {
        "category": category,
        "severity": severity,
        "base_hours": base_hours,
        "severity_multiplier": multiplier,
        "incident_adjustment": 0.80 if is_incident else 1.00,
        "predicted_hours": predicted_hours,
    }