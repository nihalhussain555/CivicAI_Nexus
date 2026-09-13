"""
Agent tools for the AI Assistant chat — implements the architecture:

    Agent Controller
      |-- Complaint Tool   (create / check status / search)
      |-- ML Tool          (department classification / priority prediction)
      |-- Duplicate Tool
      |-- RAG Tool
      |-- Escalation Tool

Every tool is a thin wrapper around an EXISTING service function (nothing
here duplicates business logic — it just exposes it to the LLM in a
structured, role-scoped, JSON-schema-described way so a real provider's
native function-calling can invoke it, and so the mock provider can
dispatch to the exact same code path deterministically without an LLM).

Authorization is enforced inside the executor, not left to the LLM's
judgment — a citizen's tool calls are always scoped to their own data
regardless of what arguments the model tries to pass.
"""

from bson import ObjectId
from bson.errors import InvalidId

from app.config.database import grievances_collection
from app.services import classification_service, priority_service, duplicate_service, rag_service
from app.services.grievance_service import (
    get_grievance_or_404, build_list_query, paginate, transition_status,
)
from app.services.notification_service import notify
from app.services.audit_service import log_action
from app.utils.helpers import serialize_document, serialize_documents
from app.utils.geo import make_point


# Approximate district-headquarters coordinates — used only as a fallback
# location when a grievance is filed through chat (no GPS available in a
# text conversation). District is what actually drives officer routing;
# this just keeps the map marker somewhere sensible rather than (0, 0).
DISTRICT_CENTROIDS = {
    "Ariyalur": (11.1401, 79.0782), "Chengalpattu": (12.6819, 79.9888),
    "Chennai": (13.0827, 80.2707), "Coimbatore": (11.0168, 76.9558),
    "Cuddalore": (11.7480, 79.7714), "Dharmapuri": (12.1211, 78.1582),
    "Dindigul": (10.3624, 77.9695), "Erode": (11.3410, 77.7172),
    "Kallakurichi": (11.7401, 78.9597), "Kanchipuram": (12.8342, 79.7036),
    "Kanyakumari": (8.0883, 77.5385), "Karur": (10.9601, 78.0766),
    "Krishnagiri": (12.5266, 78.2150), "Madurai": (9.9252, 78.1198),
    "Mayiladuthurai": (11.1085, 79.6538), "Nagapattinam": (10.7672, 79.8449),
    "Namakkal": (11.2189, 78.1677), "Nilgiris": (11.4064, 76.6932),
    "Perambalur": (11.2342, 78.8807), "Pudukkottai": (10.3833, 78.8001),
    "Ramanathapuram": (9.3639, 78.8395), "Ranipet": (12.9249, 79.3308),
    "Salem": (11.6643, 78.1460), "Sivaganga": (9.8433, 78.4809),
    "Tenkasi": (8.9598, 77.3152), "Thanjavur": (10.7870, 79.1378),
    "Theni": (10.0104, 77.4768), "Thoothukudi": (8.7642, 78.1348),
    "Tiruchirappalli": (10.7905, 78.7047), "Tirunelveli": (8.7139, 77.7567),
    "Tirupathur": (12.4950, 78.5678), "Tiruppur": (11.1085, 77.3411),
    "Tiruvallur": (13.1231, 79.9120), "Tiruvannamalai": (12.2253, 79.0747),
    "Tiruvarur": (10.7661, 79.6345), "Vellore": (12.9165, 79.1325),
    "Viluppuram": (11.9401, 79.4861), "Virudhunagar": (9.5810, 77.9624),
}


# ---------------------------------------------------------------------------
# JSON-schema tool definitions (OpenAI/Groq function-calling format — this
# is also the format Gemini's provider adapts before sending, since it's
# the most widely supported shape).
# ---------------------------------------------------------------------------

_STAFF_ONLY = {"officer", "admin"}
_CITIZEN_ONLY = {"citizen"}

TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "check_grievance_status",
            "description": "Look up the current status, department, and timeline of a specific grievance by its ID (e.g. CIV-2026-ABC12345).",
            "parameters": {
                "type": "object",
                "properties": {
                    "grievance_id": {"type": "string", "description": "The grievance's reference ID."},
                },
                "required": ["grievance_id"],
            },
        },
        "roles": {"citizen", "officer", "admin"},
    },
    {
        "type": "function",
        "function": {
            "name": "search_complaints",
            "description": "Search grievances by keyword and/or status. For a citizen this searches only their own reports; for an officer it searches their department; for an admin it searches all grievances.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Free-text search term, or omit to just filter by status."},
                    "status": {"type": "string", "description": "Optional status filter, e.g. IN_PROGRESS, CLOSED."},
                    "limit": {"type": "integer", "description": "Max results to return (default 5, max 10)."},
                },
                "required": [],
            },
        },
        "roles": {"citizen", "officer", "admin"},
    },
    {
        "type": "function",
        "function": {
            "name": "classify_department",
            "description": "Run the ML department/category classifier on a piece of grievance text to predict which civic category and department it belongs to.",
            "parameters": {
                "type": "object",
                "properties": {"text": {"type": "string", "description": "The grievance description to classify."}},
                "required": ["text"],
            },
        },
        "roles": {"citizen", "officer", "admin"},
    },
    {
        "type": "function",
        "function": {
            "name": "predict_priority_score",
            "description": "Run the ML priority predictor on a piece of grievance text to estimate urgency/priority.",
            "parameters": {
                "type": "object",
                "properties": {"text": {"type": "string", "description": "The grievance description to score."}},
                "required": ["text"],
            },
        },
        "roles": {"citizen", "officer", "admin"},
    },
    {
        "type": "function",
        "function": {
            "name": "find_similar_or_duplicate",
            "description": "Check whether a piece of grievance text looks like a duplicate of an existing report, or find similar existing cases (useful before filing a new complaint, or to check if an issue is already being tracked).",
            "parameters": {
                "type": "object",
                "properties": {"text": {"type": "string", "description": "The grievance description to compare."}},
                "required": ["text"],
            },
        },
        "roles": {"citizen", "officer", "admin"},
    },
    {
        "type": "function",
        "function": {
            "name": "search_knowledge_base",
            "description": "Search CivicAI Nexus's own FAQ/knowledge base for how the platform works (categories, routing, priority, verification, incidents, etc).",
            "parameters": {
                "type": "object",
                "properties": {"query": {"type": "string", "description": "What the user wants to know."}},
                "required": ["query"],
            },
        },
        "roles": {"citizen", "officer", "admin"},
    },
    {
        "type": "function",
        "function": {
            "name": "create_complaint",
            "description": (
                "File a new grievance on the citizen's behalf. IMPORTANT: first call this with confirm=false to "
                "get an AI-analyzed preview (category, priority, department) and show it to the citizen. Only call "
                "again with confirm=true after the citizen has explicitly agreed to file it — never file without "
                "explicit confirmation."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "A short title for the issue."},
                    "description": {"type": "string", "description": "A detailed description of the issue."},
                    "district": {"type": "string", "description": "Which Tamil Nadu district this is in (must be a real TN district name)."},
                    "confirm": {"type": "boolean", "description": "Set true only after the citizen explicitly confirms they want to file it."},
                },
                "required": ["title", "description", "district"],
            },
        },
        "roles": {"citizen"},
    },
    {
        "type": "function",
        "function": {
            "name": "escalate_case",
            "description": "Escalate a grievance for supervisory attention (officers/admins only) — actually changes its status to ESCALATED.",
            "parameters": {
                "type": "object",
                "properties": {
                    "grievance_id": {"type": "string"},
                    "reason": {"type": "string", "description": "Why this case needs escalation."},
                },
                "required": ["grievance_id", "reason"],
            },
        },
        "roles": {"officer", "admin"},
    },
    {
        "type": "function",
        "function": {
            "name": "request_priority_review",
            "description": "As a citizen, flag your own grievance to admins for urgent/priority review (does not change its status — just raises a flag with a note).",
            "parameters": {
                "type": "object",
                "properties": {
                    "grievance_id": {"type": "string"},
                    "reason": {"type": "string", "description": "Why this needs urgent attention."},
                },
                "required": ["grievance_id", "reason"],
            },
        },
        "roles": {"citizen"},
    },
]


def tools_for_role(role: str) -> list:
    """Only expose tools this role is actually allowed to invoke — the LLM
    never even sees a tool it couldn't legally call. Strips the internal
    "roles" bookkeeping field (a Python set) before returning, since that
    field isn't part of the OpenAI-style tool schema and isn't JSON
    serializable — leaving it in breaks the real provider's API call and
    silently forces a fallback to rule-based dispatch."""
    return [
        {"type": t["type"], "function": t["function"]}
        for t in TOOL_DEFINITIONS if role in t["roles"]
    ]


def tool_names_for_role(role: str) -> set:
    return {t["function"]["name"] for t in tools_for_role(role)}


# ---------------------------------------------------------------------------
# Executor — actually runs a tool call against real services/DB.
# ---------------------------------------------------------------------------

def execute_tool(tool_name: str, arguments: dict, current_user: dict) -> dict:
    role = current_user["role"]

    if tool_name not in tool_names_for_role(role):
        return {"error": f"The '{tool_name}' action isn't available for your role."}

    try:
        handler = _HANDLERS[tool_name]
    except KeyError:
        return {"error": f"Unknown tool '{tool_name}'."}

    try:
        return handler(arguments, current_user)
    except Exception as error:  # noqa: BLE001
        return {"error": f"That action failed: {error}"}


def _check_grievance_status(args, current_user):
    grievance = get_grievance_or_404(args["grievance_id"])

    if current_user["role"] == "citizen" and grievance["citizen_id"] != current_user["_id"]:
        return {"error": "That grievance ID doesn't belong to your account."}
    if current_user["role"] == "officer" and grievance.get("department") != current_user.get("department"):
        return {"error": "That grievance is outside your department."}

    return {
        "grievance_id": grievance["grievance_id"],
        "title": grievance["title"],
        "status": grievance["status"],
        "department": grievance["department"],
        "priority": grievance["priority"],
        "district": grievance.get("district"),
        "created_at": str(grievance.get("created_at")),
        "predicted_resolution_hours": grievance.get("predicted_resolution_hours"),
    }


def _search_complaints(args, current_user):
    limit = min(max(int(args.get("limit", 5) or 5), 1), 10)
    query = build_list_query(current_user, status=args.get("status"), search=args.get("query"))
    result = paginate(grievances_collection, query, page=1, limit=limit)
    items = serialize_documents(result["items"])
    return {
        "total_matches": result["total"],
        "results": [
            {
                "grievance_id": g["grievance_id"], "title": g["title"], "status": g["status"],
                "priority": g["priority"], "department": g["department"],
            }
            for g in items
        ],
    }


def _classify_department(args, current_user):
    return classification_service.classify_complaint(args["text"])


def _predict_priority_score(args, current_user):
    return priority_service.predict_priority(args["text"])


def _find_similar_or_duplicate(args, current_user):
    text = args["text"]
    classification = classification_service.classify_complaint(text)
    citizen_id = current_user["_id"] if current_user["role"] == "citizen" else None

    duplicate = duplicate_service.find_duplicate(
        text, grievances_collection, citizen_id=citizen_id, category=classification["category"],
    )
    similar = duplicate_service.find_similar_cases(
        text, grievances_collection, category=classification["category"], limit=20,
    )[:5]

    return {
        "predicted_category": classification["category"],
        "is_likely_duplicate": duplicate["duplicate"],
        "duplicate_score": duplicate["score"],
        "duplicate_of": duplicate["match"],
        "similar_cases": [{"grievance_id": c["grievance_id"], "similarity": c["similarity"]} for c in similar],
    }


def _search_knowledge_base(args, current_user):
    results = rag_service.retrieve_context(args["query"])
    return {"results": [{"source": r["source"], "text": r["text"]} for r in results]}


def _create_complaint(args, current_user):
    if current_user["role"] != "citizen":
        return {"error": "Only citizens can file grievances."}

    from app.utils.constants import DISTRICTS
    district = args.get("district", "")
    matched_district = next((d for d in DISTRICTS if d.lower() == district.lower()), None)
    if not matched_district:
        return {"error": f"'{district}' isn't a recognized Tamil Nadu district. Please ask the citizen which district this is in."}

    title, description = args["title"].strip(), args["description"].strip()

    if not args.get("confirm"):
        # Preview only — mirrors the same AI pipeline the report form uses,
        # but does NOT persist anything until the citizen explicitly agrees.
        from app.services.ai_pipeline_service import run_pipeline
        preview = run_pipeline(f"{title}. {description}", citizen_id=current_user["_id"])
        return {
            "preview": True,
            "message": "This is a PREVIEW — nothing has been filed yet. Confirm with the citizen before calling again with confirm=true.",
            "predicted_category": preview["category"],
            "predicted_priority": preview["priority"],
            "recommended_department": preview["department"],
            "predicted_resolution_hours": preview["predicted_resolution_hours"],
        }

    # Confirmed — actually file it, reusing the exact same creation path
    # as the normal report form (same AI pipeline, same routing, same
    # incident clustering), just built from chat-collected fields instead
    # of the multi-step form.
    from types import SimpleNamespace
    from app.services.grievance_service import create_grievance

    lat, lng = DISTRICT_CENTROIDS.get(matched_district, (13.0827, 80.2707))
    fake_request = SimpleNamespace(
        title=title,
        description=description,
        language="Auto",
        location=SimpleNamespace(latitude=lat, longitude=lng, address=f"{matched_district} (approximate — filed via AI Assistant)", district=matched_district),
        attachments=[],
        voice_transcript=None,
    )
    grievance = create_grievance(current_user, fake_request)
    return {
        "filed": True,
        "grievance_id": grievance["grievance_id"],
        "department": grievance["department"],
        "priority": grievance["priority"],
        "district": grievance["district"],
    }


def _escalate_case(args, current_user):
    grievance = get_grievance_or_404(args["grievance_id"])
    if current_user["role"] == "officer" and grievance.get("department") != current_user.get("department"):
        return {"error": "That grievance is outside your department."}

    updated = transition_status(
        grievance, "ESCALATED", current_user,
        message=f"Escalated via AI Assistant: {args['reason']}",
        extra_fields={"escalation_risk": "HIGH"},
    )
    return {"escalated": True, "grievance_id": updated["grievance_id"], "status": updated["status"]}


def _request_priority_review(args, current_user):
    grievance = get_grievance_or_404(args["grievance_id"])
    if grievance["citizen_id"] != current_user["_id"]:
        return {"error": "That grievance ID doesn't belong to your account."}

    log_action(
        current_user["_id"], current_user["role"], "PRIORITY_REVIEW_REQUESTED",
        "grievance", grievance["grievance_id"], {"reason": args["reason"]},
    )
    # Notify the citizen back as confirmation their request was logged —
    # this does not change the grievance's status, only flags it.
    notify(
        current_user["_id"], "Priority review requested",
        f"Your request for urgent review of {grievance['grievance_id']} has been logged.",
        notification_type="INFO", related_grievance_id=grievance["grievance_id"],
    )
    return {"requested": True, "grievance_id": grievance["grievance_id"]}


_HANDLERS = {
    "check_grievance_status": _check_grievance_status,
    "search_complaints": _search_complaints,
    "classify_department": _classify_department,
    "predict_priority_score": _predict_priority_score,
    "find_similar_or_duplicate": _find_similar_or_duplicate,
    "search_knowledge_base": _search_knowledge_base,
    "create_complaint": _create_complaint,
    "escalate_case": _escalate_case,
    "request_priority_review": _request_priority_review,
}