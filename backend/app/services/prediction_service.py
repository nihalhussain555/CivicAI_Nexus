from datetime import datetime, timedelta

from app.config.settings import settings


# Baseline resolution hours by category, tuned by severity multiplier.
# In a real deployment this would be a regression model trained on
# historical `grievances` data (see ai/training/); the heuristic here keeps
# the product fully functional without requiring a trained model.
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

SEVERITY_MULTIPLIER = {
    "CRITICAL": 0.35,
    "HIGH": 0.6,
    "MEDIUM": 1.0,
    "LOW": 1.3,
}

SLA_HOURS_BY_PRIORITY = {
    "CRITICAL": lambda s: s.SLA_HOURS_CRITICAL,
    "HIGH": lambda s: s.SLA_HOURS_HIGH,
    "MEDIUM": lambda s: s.SLA_HOURS_MEDIUM,
    "LOW": lambda s: s.SLA_HOURS_LOW,
}


def predict_resolution_hours(category: str, severity: str, is_incident: bool = False) -> int:
    base = BASE_RESOLUTION_HOURS.get(category, BASE_RESOLUTION_HOURS["GENERAL"])
    multiplier = SEVERITY_MULTIPLIER.get(severity, 1.0)
    hours = base * multiplier
    if is_incident:
        # Clustered/community incidents tend to get prioritized field response.
        hours *= 0.8
    return max(2, round(hours))


def compute_sla_due_at(priority: str, created_at: datetime = None) -> tuple[datetime, int]:
    created_at = created_at or datetime.utcnow()
    sla_hours = SLA_HOURS_BY_PRIORITY.get(priority, SLA_HOURS_BY_PRIORITY["MEDIUM"])(settings)
    return created_at + timedelta(hours=sla_hours), sla_hours


def assess_escalation_risk(
    priority: str,
    duplicate_score: float,
    similar_case_count: int,
    hours_since_created: float = 0,
    sla_hours: int = 72,
) -> str:
    """Rule-based SLA-risk classifier. Escalation risk rises as a case
    approaches or exceeds its SLA window, or when community pressure
    (many similar/duplicate reports) is high."""
    score = 0

    if priority in ("HIGH", "CRITICAL"):
        score += 2
    elif priority == "MEDIUM":
        score += 1

    if similar_case_count >= 5:
        score += 2
    elif similar_case_count >= 2:
        score += 1

    if duplicate_score >= 70:
        score += 1

    if sla_hours:
        elapsed_ratio = hours_since_created / sla_hours
        if elapsed_ratio >= 1:
            score += 3
        elif elapsed_ratio >= 0.75:
            score += 2
        elif elapsed_ratio >= 0.5:
            score += 1

    if score >= 5:
        return "HIGH"
    if score >= 2:
        return "MEDIUM"
    return "LOW"
