"""
Agent Controller — orchestrates the AI Assistant's tool-calling loop.

Two execution paths:

1. Real tool-calling providers (OpenAI, Groq — anything with
   provider.supports_tools = True): a genuine multi-round agent loop.
   The LLM decides which tool(s) to call, we execute them for real against
   the actual database/services, feed results back, and let the model
   either call more tools or produce a final answer.

2. Everything else (Mock provider, or Gemini which doesn't have a
   verified tool-calling integration here): a deterministic, regex-based
   single-tool dispatcher. This keeps the whole agent feature working
   fully offline/free, per this project's "must work without a paid API"
   philosophy — it just can't chain multiple tools in one turn the way a
   real LLM can.

Either path ends by handing the tool result(s) to the provider's plain
`chat()` for a natural-language final response, so the user never sees
raw JSON.
"""

import json
import re

from app.ai.provider import get_ai_provider, MockAIProvider
from app.ai.tools import tools_for_role, execute_tool
from app.services.rag_service import retrieve_context


MAX_AGENT_ROUNDS = 4

SYSTEM_PROMPT_TEMPLATE = """You are the CivicAI Nexus AI Assistant, embedded in a small chat widget for a {role}.
You have tools available to actually look up, search, classify, and (for citizens) file grievances — use them
instead of guessing whenever the user's question needs real data. Always call check_grievance_status or
search_complaints before claiming you know a case's status. For create_complaint, ALWAYS preview first
(confirm=false) and get explicit user agreement before filing for real (confirm=true).
Keep replies short (2-5 sentences), no markdown tables/headers, plain conversational tone."""


def _looks_like_grievance_id(text: str):
    match = re.search(r"\bCIV-\d{4}-[A-Z0-9]{6,10}\b", text, re.IGNORECASE)
    return match.group(0).upper() if match else None


def run_agent_chat(message: str, current_user: dict, history: list, language: str = "English") -> dict:
    """
    Returns {"response": str, "tool_calls": [ {"name":..., "result":...}, ... ]}
    `tool_calls` is empty for a plain conversational reply — useful for the
    frontend to show "used a tool" transparency if it wants to.
    """
    provider = get_ai_provider()

    if provider.supports_tools:
        try:
            return _run_real_agent_loop(provider, message, current_user, history, language)
        except Exception as error:  # noqa: BLE001
            print(f"WARNING: agent tool-calling loop failed ({error}), falling back to rule-based dispatch")

    return _run_rule_based_dispatch(message, current_user, language)


# ---------------------------------------------------------------------------
# Path 1: real multi-round tool-calling loop
# ---------------------------------------------------------------------------

def _run_real_agent_loop(provider, message, current_user, history, language):
    role = current_user["role"]
    tools = tools_for_role(role)

    messages = [{"role": "system", "content": SYSTEM_PROMPT_TEMPLATE.format(role=role)}]
    # Fold in recent conversation turns (already-persisted session history)
    for turn in history[-8:]:
        messages.append({"role": turn["role"], "content": turn["text"]})
    messages.append({"role": "user", "content": message})

    tool_call_log = []

    for _ in range(MAX_AGENT_ROUNDS):
        result = provider.chat_with_tools(messages, tools)

        if result["type"] == "text":
            return {"response": result["content"], "tool_calls": tool_call_log}

        # result["type"] == "tool_calls"
        raw_assistant_message = result["raw_message"]
        for call in result["calls"]:
            try:
                arguments = json.loads(call["arguments"]) if call["arguments"] else {}
            except json.JSONDecodeError:
                arguments = {}

            tool_result = execute_tool(call["name"], arguments, current_user)
            tool_call_log.append({"name": call["name"], "arguments": arguments, "result": tool_result})

            provider.append_tool_result(
                messages, raw_assistant_message, call["id"], json.dumps(tool_result, default=str),
            )

    # Ran out of rounds — ask the provider for a plain final summary of
    # whatever we've learned instead of looping forever.
    final = provider.chat(
        "Summarize what you found for the user in 2-3 sentences, plainly.",
        language=language, context=json.dumps(tool_call_log, default=str),
    )
    return {"response": final, "tool_calls": tool_call_log}


# ---------------------------------------------------------------------------
# Path 2: deterministic rule-based dispatch (mock provider / non-tool
# providers) — picks at most one tool per turn from simple pattern
# matching, then asks the provider to phrase the result naturally.
# ---------------------------------------------------------------------------

def _run_rule_based_dispatch(message: str, current_user: dict, language: str):
    provider = get_ai_provider()
    lowered = message.lower()
    tool_call_log = []

    grievance_id = _looks_like_grievance_id(message)

    if grievance_id and any(w in lowered for w in ("status", "where", "update", "progress", "track")):
        result = execute_tool("check_grievance_status", {"grievance_id": grievance_id}, current_user)
        tool_call_log.append({"name": "check_grievance_status", "result": result})
        return {"response": _phrase_result(provider, "check_grievance_status", result, language), "tool_calls": tool_call_log}

    if any(w in lowered for w in ("my complaints", "my grievances", "my reports", "search")):
        result = execute_tool("search_complaints", {"query": None, "limit": 5}, current_user)
        tool_call_log.append({"name": "search_complaints", "result": result})
        return {"response": _phrase_result(provider, "search_complaints", result, language), "tool_calls": tool_call_log}

    if current_user["role"] in ("officer", "admin") and "escalat" in lowered and grievance_id:
        result = execute_tool(
            "escalate_case", {"grievance_id": grievance_id, "reason": "Requested via AI Assistant"}, current_user,
        )
        tool_call_log.append({"name": "escalate_case", "result": result})
        return {"response": _phrase_result(provider, "escalate_case", result, language), "tool_calls": tool_call_log}

    # Default: plain RAG-grounded conversational answer (same behavior as
    # before this upgrade) — covers general "how does this work" questions.
    context_items = retrieve_context(message)
    context_text = "\n".join(item["text"] for item in context_items)
    response = provider.chat(message, language=language, context=context_text)
    return {"response": response, "tool_calls": tool_call_log}


def _phrase_result(provider, tool_name: str, result: dict, language: str) -> str:
    if isinstance(provider, MockAIProvider):
        return _mock_phrase(tool_name, result)
    try:
        return provider.chat(
            "Phrase this tool result for the user in 1-3 short, plain sentences. Don't show raw JSON or field names verbatim.",
            language=language, context=json.dumps(result, default=str),
        )
    except Exception:  # noqa: BLE001
        return _mock_phrase(tool_name, result)


def _mock_phrase(tool_name: str, result: dict) -> str:
    if "error" in result:
        return result["error"]

    if tool_name == "check_grievance_status":
        return (
            f"Grievance {result['grievance_id']} (\"{result['title']}\") is currently "
            f"{result['status'].replace('_', ' ').title()}, with {result['priority'].lower()} priority, "
            f"routed to {result['department']}."
        )

    if tool_name == "search_complaints":
        if not result["results"]:
            return "I didn't find any matching grievances."
        lines = [f"{r['grievance_id']} — {r['title']} ({r['status'].replace('_', ' ').title()})" for r in result["results"]]
        return f"Found {result['total_matches']} matching grievance(s):\n- " + "\n- ".join(lines)

    if tool_name == "escalate_case":
        return f"Grievance {result['grievance_id']} has been escalated."

    return "Here's what I found: " + json.dumps(result, default=str)