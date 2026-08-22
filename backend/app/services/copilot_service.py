from app.ai.provider import get_ai_provider, MockAIProvider
from app.config.database import grievances_collection
from app.services.duplicate_service import find_similar_cases


def build_copilot_brief(grievance: dict) -> dict:
    """
    Produces the officer-facing AI Copilot brief: case summary, risk
    assessment, similar cases, a recommended action, and a suggested
    citizen-facing response. The officer must explicitly accept or modify
    this — nothing here is executed automatically.
    """
    similar_cases = find_similar_cases(
        f"{grievance.get('title', '')} {grievance.get('description', '')}",
        grievances_collection,
        category=grievance.get("category"),
        exclude_id=grievance.get("grievance_id"),
    )[:5]

    provider = get_ai_provider()
    try:
        brief = provider.generate_copilot_brief(grievance, similar_cases)
    except Exception as error:  # noqa: BLE001
        if provider.name != "mock":
            print(f"WARNING: {provider.name} copilot failed, using mock: {error}")
            brief = MockAIProvider().generate_copilot_brief(grievance, similar_cases)
        else:
            raise

    brief["is_ai_generated"] = True
    brief["requires_officer_approval"] = True
    return brief
