"""
Lightweight retrieval used by the /api/ai/chat assistant to ground answers
about how the platform works (categories, department routing, tracking).

A production deployment would embed the contents of `knowledge_base/` with
app/ai/vector_store.py + a real embedding model. To keep the product fully
functional without any paid API, this module ships a small curated FAQ and
matches it with keyword overlap instead of embeddings.
"""

import re


KNOWLEDGE_BASE = [
    {
        "source": "faq/tracking",
        "keywords": {"track", "status", "id", "grievance", "check"},
        "text": (
            "You can track any grievance from Citizen > My Grievances using its "
            "grievance ID, or open it directly for the full status timeline."
        ),
    },
    {
        "source": "faq/categories",
        "keywords": {"category", "categories", "type", "classify"},
        "text": (
            "Grievances are auto-classified into categories such as Waste, Water, "
            "Road, Electricity, Street Light, Drainage, Traffic, and Public Safety."
        ),
    },
    {
        "source": "faq/departments",
        "keywords": {"department", "route", "assigned", "who"},
        "text": (
            "Each category routes to a matching department (e.g. Waste -> Sanitation "
            "Department). An officer in that department then accepts the case."
        ),
    },
    {
        "source": "faq/priority",
        "keywords": {"priority", "urgent", "severity", "sla"},
        "text": (
            "Priority (LOW/MEDIUM/HIGH/CRITICAL) is AI-estimated from the report text "
            "and drives the SLA response window - higher priority cases get shorter "
            "resolution deadlines."
        ),
    },
    {
        "source": "faq/verification",
        "keywords": {"resolve", "resolved", "verify", "reopen", "close"},
        "text": (
            "Once an officer marks a grievance resolved, the citizen is asked to "
            "verify the fix. If it isn't actually resolved, the citizen can reopen it."
        ),
    },
    {
        "source": "faq/incidents",
        "keywords": {"incident", "community", "cluster", "many", "duplicate"},
        "text": (
            "When several nearby citizens report the same kind of issue, CivicAI "
            "groups them into a community 'incident' so officers can address the "
            "root cause instead of duplicate individual cases."
        ),
    },
]


def _tokenize(text):
    return set(re.findall(r"[a-z0-9]+", text.lower()))


def retrieve_context(query: str, top_k: int = 2):
    tokens = _tokenize(query)
    scored = []

    for entry in KNOWLEDGE_BASE:
        overlap = len(tokens & entry["keywords"])
        if overlap > 0:
            scored.append((overlap, entry))

    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [entry for _, entry in scored[:top_k]]
