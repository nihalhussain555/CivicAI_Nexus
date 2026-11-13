"""
Agent Controller — orchestrates the AI Assistant's tool-calling loop, and the
language layer that wraps it.

Two execution paths:

1. Real tool-calling providers (OpenAI, Groq — anything with
   provider.supports_tools = True): a genuine multi-round agent loop.
   The LLM decides which tool(s) to call, we execute them for real against
   the actual database/services, feed results back, and let the model
   either call more tools or produce a final answer.

2. Everything else (Mock provider, or Gemini which doesn't have a
   verified tool-calling integration here): a deterministic, regex-based
   dispatcher. This keeps the whole agent feature working fully
   offline/free, per this project's "must work without a paid API"
   philosophy — it just can't chain multiple tools in one turn the way a
   real LLM can.

Either path ends by handing the tool result(s) to the provider's plain
`chat()` for a natural-language final response, so the user never sees
raw JSON.

Around both paths sits the language decision. A message is read for its
language first (locally, and by the model when the text is not plain
English), the tools are handed the English rendering because the keyword
rules and duplicate matching are built in English, and the answer is asked
for in the language the citizen used. When the provider cannot answer in
that language — offline mode, which has no translation — the response says
so plainly instead of passing English off as Tamil.
"""

import json
import re

from app.ai.provider import get_ai_provider, MockAIProvider
from app.ai.tools import tools_for_role, execute_tool
from app.services.rag_service import retrieve_context
from app.services.translation_service import (
    PROCESSING_LANGUAGE,
    SUPPORTED_LANGUAGES,
    language_name,
    understand_text,
)


MAX_AGENT_ROUNDS = 4

# "Leave the pending offer alone" — distinct from None, which means clear it.
_KEEP = object()

SYSTEM_PROMPT_TEMPLATE = """You are the CivicAI Nexus AI Assistant, embedded in a small chat widget for a {role}.
You have tools available to actually look up, search, classify, and (for citizens) file grievances — use them
instead of guessing whenever the user's question needs real data. Always call check_grievance_status or
search_complaints before claiming you know a case's status. For create_complaint, ALWAYS preview first
(confirm=false) and get explicit user agreement before filing for real (confirm=true).
Keep replies short (2-5 sentences), no markdown tables/headers, plain conversational tone.

Answer in {language}. If the citizen mixed two languages, answer in the one
carrying their sentence and keep every place name, grievance ID and number
exactly as they wrote it."""

# A spoken "yes" is what files a complaint, so recognising it in every
# supported language is not a nicety. Kept deliberately short and word-
# boundary matched, because "no" also appears inside "nobody".
AFFIRMATIVE = {
    "yes", "yeah", "yep", "sure", "ok", "okay", "please do", "do it", "file it",
    "submit", "go ahead", "confirm", "correct", "thats right", "that's right",
    "sari", "silari", "avere", "aaam", "aha", "ok dk",
    "ha", "han", "ji", "theek", "sahi", "kar do",
    "illa kodukkam", "cheysu", "madi", "cheyi", "bagiru",
}
NEGATIVE = {"no", "dont", "don't", "stop", "cancel", "wait", "illa", "nahi", "venda", "kudutha"}

# Voice filing and tracking are phrased in six languages; the offline
# dispatcher has to catch the intent in all of them or the feature only
# works for the citizen who happened to speak English.
FILE_INTENT_WORDS = (
    "i want to report", "i want to file", "file a complaint", "lodge a complaint",
    "register a complaint", "report a problem", "new complaint", "raise an issue",
    "file this", "submit this", "book this", "add a complaint",
    "pugarvu", "pukarvu", "daraku seyya", "komai", "petchi",
    "shikayat", "dakhil", "dar kar", "dara karava", "nikki",
    "dakhyal karu", "rekha",
)
TRACK_INTENT_WORDS = (
    "status", "track", "where is", "what happened", "update", "progress",
    "my complaint", "my grievance", "my case", "my report", "last complaint",
    "latest complaint", "my previous complaint", "check my",
    "evvalavu", "enthal", "status", "yennai",
    "kitham", "evittonnu",
    "kahan", "kya hua", "kab", "halka",
)

# Grievance IDs survive voice recognition badly ("C I V dash twenty twenty
# six"), so match loosely and canonicalise before using the value.
_LOOSE_GRIEVANCE_ID = re.compile(r"\bciv[\s\-_]*\d{4}[\s\-_]*[a-z0-9]{6,12}\b", re.IGNORECASE)


def _looks_like_grievance_id(text: str):
    match = _LOOSE_GRIEVANCE_ID.search(text or "")
    if not match:
        return None
    raw = re.sub(r"[^A-Za-z0-9]", "", match.group(0)).upper()
    # CIV + 4-digit year + the rest is the reference.
    return f"{raw[:3]}-{raw[3:7]}-{raw[7:]}"


def run_agent_chat(
    message: str,
    current_user: dict,
    history: list,
    language: str = "Auto",
    pending_complaint: dict = None,
) -> dict:
    """Returns the reply plus everything the caller needs to record and to
    speak the answer back in the right voice:

    {response, tool_calls, language, language_code, heard_language,
     heard_language_code, language_source, pending_complaint,
     filed_grievance_id}
    """
    read = _read_language(message, language)
    provider = get_ai_provider()

    # The tools work in English: keyword rules, duplicate scoring and the
    # knowledge base are all English-indexed. The citizen never sees this.
    search_text = read["translated_text"] if read["translated"] else message

    common = {
        "heard_language": read["language"],
        "heard_language_code": read["language_code"],
        "language_source": read["source"],
    }

    if provider.supports_tools:
        try:
            result = _run_real_agent_loop(
                provider, message, search_text, current_user, history, read, pending_complaint,
            )
            return {**result, **common, "filed_grievance_id": _filed_id_from(result)}
        except Exception as error:  # noqa: BLE001
            print(f"WARNING: agent tool-calling loop failed ({error}), falling back to rule-based dispatch")

    result = _run_rule_based_dispatch(message, search_text, current_user, read, pending_complaint)
    return {**result, **common, "filed_grievance_id": _filed_id_from(result)}


def _filed_id_from(result: dict):
    """The grievance reference a create_complaint tool call actually filed on
    this turn, if any. The caller stamps the voice metadata onto it, so a
    complaint that began as a recording keeps that history whichever
    execution path filed it."""
    for call in result.get("tool_calls") or []:
        if call.get("name") != "create_complaint":
            continue
        tool_result = call.get("result") or {}
        if tool_result.get("filed"):
            return tool_result.get("grievance_id")
    return None


def _read_language(message: str, hint: str) -> dict:
    """Resolve what language this turn is in, and what to hand the tools.

    An explicit hint wins (the citizen, or the speech model on a voice turn,
    has already said); "Auto" runs the deterministic local read, which only
    costs a provider call when the text is not plain English."""
    explicit = hint and str(hint).strip().lower() not in ("auto", "")
    if explicit:
        named = language_name(hint)
        read = understand_text(message, hint=named)
        language = read["language"]
        source = "chosen"
    else:
        read = understand_text(message)
        language = read["language"]
        source = "auto-detected" if language != PROCESSING_LANGUAGE else "default"

    return {
        "language": language,
        "language_code": SUPPORTED_LANGUAGES[language],
        "code_mixed": read["code_mixed"],
        "translated_text": read["translated_text"],
        "translated": read["translated"],
        "source": source,
    }


def _answer_language(read: dict, provider) -> tuple:
    """Which language the reply is genuinely in — the number the frontend
    needs before it opens a text-to-speech voice.

    Offline mode answers in English whatever it heard, and saying so is the
    point: a Tamil-labelled English sentence read out by a Tamil voice is
    worse than an honest English one."""
    if isinstance(provider, MockAIProvider):
        return PROCESSING_LANGUAGE, SUPPORTED_LANGUAGES[PROCESSING_LANGUAGE]
    return read["language"], read["language_code"]


# ---------------------------------------------------------------------------
# Path 1: real multi-round tool-calling loop
# ---------------------------------------------------------------------------

def _run_real_agent_loop(provider, message, search_text, current_user, history, read, pending_complaint):
    role = current_user["role"]
    tools = tools_for_role(role)
    answer_language, answer_code = _answer_language(read, provider)

    messages = [{"role": "system", "content": SYSTEM_PROMPT_TEMPLATE.format(
        role=role, language=answer_language,
    )}]
    # Fold in recent conversation turns (already-persisted session history)
    for turn in history[-8:]:
        messages.append({"role": turn["role"], "content": turn["text"]})
    messages.append({"role": "user", "content": message})

    # A preview offer from an earlier turn is still on the table. Tell the
    # model, so a bare "yes" means "file the one you just described".
    if pending_complaint and _is_affirmative(message):
        result = execute_tool("create_complaint", {**pending_complaint, "confirm": True}, current_user)
        return {
            "response": _phrase_filed(result, answer_language, provider),
            "tool_calls": [{"name": "create_complaint", "result": result}],
            "language": answer_language,
            "language_code": answer_code,
            "pending_complaint": None,
        }

    if pending_complaint and _is_negative(message):
        return {
            "response": _preview_dropped(answer_language, provider),
            "tool_calls": [],
            "language": answer_language,
            "language_code": answer_code,
            "pending_complaint": None,
        }

    tool_call_log = []
    pending = None

    for _ in range(MAX_AGENT_ROUNDS):
        result = provider.chat_with_tools(messages, tools)

        if result["type"] == "text":
            return {
                "response": result["content"],
                "tool_calls": tool_call_log,
                "language": answer_language,
                "language_code": answer_code,
                "pending_complaint": pending if pending is not None else pending_complaint,
            }

        raw_assistant_message = result["raw_message"]
        for call in result["calls"]:
            try:
                arguments = json.loads(call["arguments"]) if call["arguments"] else {}
            except json.JSONDecodeError:
                arguments = {}

            tool_result = execute_tool(call["name"], arguments, current_user)
            tool_call_log.append({"name": call["name"], "arguments": arguments, "result": tool_result})

            if call["name"] == "create_complaint":
                if tool_result.get("preview"):
                    pending = {k: arguments[k] for k in ("title", "description", "district", "language") if k in arguments}
                    # A model that ignores the language parameter still
                    # shouldn't lose what the citizen actually spoke in.
                    pending["language"] = arguments.get("language") or read["language"]
                elif tool_result.get("filed"):
                    pending = None

            provider.append_tool_result(
                messages, raw_assistant_message, call["id"], json.dumps(tool_result, default=str),
            )

    final = provider.chat(
        "Summarize what you found for the user in 2-3 sentences, plainly.",
        language=answer_language, context=json.dumps(tool_call_log, default=str),
    )
    return {
        "response": final,
        "tool_calls": tool_call_log,
        "language": answer_language,
        "language_code": answer_code,
        "pending_complaint": pending if pending is not None else pending_complaint,
    }


def _phrase_filed(result: dict, language: str, provider) -> str:
    if not result.get("filed"):
        return result.get("error") or "I could not file that complaint."
    if isinstance(provider, MockAIProvider) or language == PROCESSING_LANGUAGE:
        return (
            f"Filed. Your grievance reference is {result['grievance_id']}, routed to "
            f"{result['department']} in {result['district']}."
        )
    try:
        return provider.chat(
            "Tell the citizen, in one or two sentences, that their complaint is filed and "
            "give them the reference to track it by.",
            language=language, context=json.dumps(result, default=str),
        )
    except Exception:  # noqa: BLE001
        return (
            f"Filed. Your grievance reference is {result['grievance_id']}, routed to "
            f"{result['department']} in {result['district']}."
        )


def _preview_dropped(language: str, provider) -> str:
    """A declined preview must leave no doubt that nothing was filed — an
    ambiguous "okay" here is how citizens end up believing a complaint exists
    when it does not."""
    plain = "Cancelled — nothing was filed. Tell me what to change and I will show it to you again."
    if isinstance(provider, MockAIProvider) or language == PROCESSING_LANGUAGE:
        return plain
    try:
        return provider.chat(
            "Tell the citizen, in one short sentence, that the complaint was NOT filed and "
            "they can change the details for me to show again.",
            language=language,
        )
    except Exception:  # noqa: BLE001
        return plain


# ---------------------------------------------------------------------------
# Path 2: deterministic rule-based dispatch (mock provider / non-tool
# providers) — picks at most one tool per turn from simple pattern
# matching, then asks the provider to phrase the result naturally.
# ---------------------------------------------------------------------------

def _run_rule_based_dispatch(message, search_text, current_user, read, pending_complaint):
    provider = get_ai_provider()
    answer_language, answer_code = _answer_language(read, provider)
    lowered = (message or "").lower()
    searchable = (search_text or "").lower()

    def done(response, tool_name=None, result=None, pending=_KEEP):
        return {
            "response": response,
            "tool_calls": [{"name": tool_name, "result": result}] if tool_name else [],
            "language": answer_language,
            "language_code": answer_code,
            "pending_complaint": pending if pending is not _KEEP else pending_complaint,
        }

    grievance_id = _looks_like_grievance_id(message)

    # A spoken "yes" to the preview we offered last turn, with the offer's
    # details still on the session — the whole point of storing it.
    if pending_complaint and _is_affirmative(message):
        result = execute_tool("create_complaint", {**pending_complaint, "confirm": True}, current_user)
        return done(_phrase_filed(result, answer_language, provider), "create_complaint", result, pending=None)

    if pending_complaint and _is_negative(message):
        return done(_preview_dropped(answer_language, provider), pending=None)

    # An ID in the message is the strongest possible intent signal; whether
    # the citizen asked in Tamil, English or a mix, they want that case.
    if grievance_id and (_matches(lowered, TRACK_INTENT_WORDS) or _matches(searchable, TRACK_INTENT_WORDS)):
        result = execute_tool("check_grievance_status", {"grievance_id": grievance_id}, current_user)
        return done(_phrase_result(provider, "check_grievance_status", result, answer_language),
                    "check_grievance_status", result)

    if _matches(lowered, TRACK_INTENT_WORDS) or _matches(searchable, TRACK_INTENT_WORDS):
        result = execute_tool("search_complaints", {"query": None, "limit": 5}, current_user)
        return done(_phrase_result(provider, "search_complaints", result, answer_language),
                    "search_complaints", result)

    if (_matches(lowered, FILE_INTENT_WORDS) or _matches(searchable, FILE_INTENT_WORDS)) \
            and current_user["role"] == "citizen":
        district = _district_in(message) or _district_in(search_text)
        if not district:
            # Filing needs a district to route to, and guessing one would send
            # the complaint to the wrong office. Ask.
            return done(_ask_for_district(read))

        title = _title_from(message)
        arguments = {
            "title": title,
            "description": message.strip(),
            "district": district,
            "language": read["language"],
        }
        preview = execute_tool("create_complaint", {**arguments, "confirm": False}, current_user)
        return done(
            _offer_preview(preview, read, district),
            "create_complaint", preview,
            pending=arguments,
        )

    if current_user["role"] in ("officer", "admin") and "escalat" in lowered and grievance_id:
        result = execute_tool(
            "escalate_case", {"grievance_id": grievance_id, "reason": "Requested via AI Assistant"}, current_user,
        )
        return done(_phrase_result(provider, "escalate_case", result, answer_language),
                    "escalate_case", result)

    # Default: plain RAG-grounded conversational answer (same behavior as
    # before this upgrade) — covers general "how does this work" questions.
    context_items = retrieve_context(search_text if read["translated"] else message)
    context_text = "\n".join(item["text"] for item in context_items)
    response = provider.chat(message, language=answer_language, context=context_text)
    return done(response)


def _matches(text: str, phrases) -> bool:
    return any(phrase in text for phrase in phrases)


def _is_affirmative(message: str) -> bool:
    words = re.findall(r"[a-z']+", (message or "").lower())
    if not words:
        return False
    if any(word in NEGATIVE for word in words[:3]):
        return False
    return any(word in AFFIRMATIVE for word in words[:4]) or bool(
        re.search(r"\b(yes|sari|haan|ok|please)\b", (message or "").lower())
    )


def _is_negative(message: str) -> bool:
    words = re.findall(r"[a-z']+", (message or "").lower())
    return any(word in NEGATIVE for word in words[:3])


def _district_in(text: str):
    from app.utils.constants import DISTRICTS

    lowered = (text or "").lower()
    for district in DISTRICTS:
        if district.lower() in lowered:
            return district
    return None


def _title_from(description: str) -> str:
    words = " ".join((description or "").split()[:9])
    return (words[:200] or "Voice complaint")


def _ask_for_district(read: dict) -> str:
    return (
        "Which district is this in? Tell me the district and I will file it for you."
        if read["language"] == PROCESSING_LANGUAGE else
        f"Which district is this in? (I heard you say this in {read['language']}, "
        "and I can only answer in English while the platform runs offline.)"
    )


def _offer_preview(preview: dict, read: dict, district: str) -> str:
    if preview.get("error"):
        return preview["error"]
    heard = "" if read["language"] == PROCESSING_LANGUAGE else f" I heard {read['language']}."
    return (
        f"Here is what I would file: {preview['predicted_category'].replace('_', ' ').lower()}, "
        f"{str(preview['predicted_priority']).lower()} priority, to {preview['recommended_department']} "
        f"in {district}, about {preview['predicted_resolution_hours']} hours expected."
        f"{heard} Say yes and I will file it — or tell me what to change."
    )


def _phrase_result(provider, tool_name: str, result: dict, language: str) -> str:
    if isinstance(provider, MockAIProvider):
        return _mock_phrase(tool_name, result)
    try:
        return provider.chat(
            "Phrase this tool result for the user in 1-3 short, plain sentences. "
            "Don't show raw JSON or field names verbatim.",
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
