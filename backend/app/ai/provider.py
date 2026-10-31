"""
Provider-independent AI abstraction.

Every provider implements the same interface (`BaseAIProvider`) so the rest
of the backend never has to know whether it is talking to the deterministic
MockAIProvider or a real LLM. The frontend never talks to a provider
directly and no provider API key is ever sent to the browser.

Selection is controlled purely by the AI_PROVIDER env var (mock | openai |
gemini). If a real provider is selected but misconfigured or the call
fails for any reason, we transparently fall back to the mock provider so
the product keeps working end-to-end (spec: "MUST work without paid AI
APIs").
"""

import json
import re
from abc import ABC, abstractmethod

from app.config.settings import settings
from app.ai.prompts import build_analysis_prompt, build_authenticity_prompt
from app.services.classification_service import classify_complaint
from app.services.priority_service import predict_priority
from app.services.sentiment_service import analyze_sentiment


class BaseAIProvider(ABC):
    name = "base"
    supports_tools = False
    # Whether this provider can do a bare one-shot completion for a JSON-only
    # instruction (needed by assess_authenticity). Mock answers authenticity
    # locally instead, so it doesn't need one.
    supports_json_completion = False

    @abstractmethod
    def analyze_grievance(self, text: str, language: str = "English") -> dict:
        ...

    @abstractmethod
    def generate_copilot_brief(self, grievance: dict, similar_cases: list) -> dict:
        ...

    @abstractmethod
    def chat(self, message: str, language: str = "English", context: str = "") -> str:
        ...

    def assess_authenticity(self, text: str, context_note: str = "") -> dict:
        """Independent read on whether the reported problem sounds real.
        Returns {verdict, score, indicators, reasoning, provider}. Unlike the
        other methods this one has a base implementation that returns a
        neutral no-op rather than raising: authenticity fusion is additive,
        so a provider that hasn't implemented it simply contributes nothing
        instead of breaking submission. See authenticity_service for how the
        result is merged with the rule score.

        The default uses a provider's plain one-shot completion
        (`_complete`) rather than `chat`, because chat() carries the
        conversational widget's persona and formatting rules — which actively
        fight a "return ONLY JSON" instruction."""
        if not self.supports_json_completion:
            return self._no_authenticity_read("provider has no plain completion path")

        try:
            raw = self._complete(build_authenticity_prompt(text, context_note))
            data = _extract_json(raw)
        except Exception as error:  # noqa: BLE001
            return self._no_authenticity_read(f"authenticity call failed: {error}")

        return _normalize_authenticity_read(data, self.name)

    def _no_authenticity_read(self, why: str) -> dict:
        return {
            "verdict": None,
            "score": None,
            "indicators": [],
            "reasoning": f"No AI authenticity read ({why}).",
            "provider": self.name,
        }

    def _complete(self, prompt: str) -> str:
        raise NotImplementedError(f"{self.name} does not support plain completion")

    def chat_with_tools(self, messages: list, tools: list):
        """
        One round of an agent tool-calling turn. Returns either
        {"type": "tool_calls", "calls": [{"id", "name", "arguments"}, ...]}
        or {"type": "text", "content": "..."}.
        Only real providers that implement native function-calling override
        this — the mock provider and any provider without tool support
        simply isn't used for the agent path (see agent_service.py, which
        falls back to a deterministic rule-based dispatcher instead).
        """
        raise NotImplementedError(f"{self.name} does not support tool calling")


class MockAIProvider(BaseAIProvider):
    """
    Deterministic, fully local provider. No network calls. Guarantees the
    entire product works in demo/offline mode. Reuses the existing
    rule-based classification/priority/sentiment services and layers
    severity/urgency/confidence/recommended_action on top so the output
    matches the full AI OUTPUT contract from the spec.
    """

    name = "mock"

    def analyze_grievance(self, text: str, language: str = "English") -> dict:
        classification = classify_complaint(text)
        priority = predict_priority(text)
        sentiment = analyze_sentiment(text)

        # Severity mirrors priority but is a distinct axis (impact vs. how
        # fast it needs handling) — nudge it using keyword density.
        severity_map = {"HIGH": "HIGH", "MEDIUM": "MEDIUM", "LOW": "LOW"}
        severity = severity_map.get(priority["priority"], "LOW")
        if priority["priority"] == "HIGH" and len(priority["matched_keywords"]) >= 2:
            severity = "CRITICAL"

        urgency_score = min(100, priority["score"] + (5 if sentiment == "NEGATIVE" else 0))

        confidence = round(
            0.55 + 0.15 * min(len(priority["matched_keywords"]), 2)
            + (0.1 if classification["scores"].get(classification["category"], 0) > 0 else 0),
            2,
        )
        confidence = min(confidence, 0.97)

        recommended_action_map = {
            "HIGH": "Dispatch a field officer within 24 hours and notify the department head.",
            "MEDIUM": "Assign to the relevant department officer for review within 72 hours.",
            "LOW": "Log the grievance and schedule routine follow-up.",
        }

        summary = (
            f"Citizen reported a {classification['category'].lower().replace('_', ' ')} "
            f"issue. Classified under {classification['department']} with "
            f"{priority['priority'].lower()} priority."
        )

        matched = priority.get("matched_keywords") or []
        reason = (
            f"Matched keyword(s) {', '.join(matched[:3])} strongly associated with "
            f"{classification['department']}."
            if matched
            else f"Best keyword match against the {classification['department']} category "
                 "with no strong signal for a more specific department."
        )

        return {
            "category": classification["category"],
            "subcategory": None,
            "severity": severity,
            "urgency_score": urgency_score,
            "priority": priority["priority"],
            "priority_score": priority["score"],
            "confidence": confidence,
            "sentiment": sentiment,
            "recommended_department": classification["department"],
            "reason": reason,
            "summary": summary,
            "recommended_action": recommended_action_map[priority["priority"]],
            "provider": self.name,
        }

    def generate_copilot_brief(self, grievance: dict, similar_cases: list) -> dict:
        category = grievance.get("category", "GENERAL").lower().replace("_", " ")
        priority = grievance.get("priority", "LOW")

        return {
            "case_summary": (
                f"{category.title()} grievance ({grievance.get('grievance_id')}) with "
                f"{priority.lower()} priority, currently '{grievance.get('status')}'. "
                f"{grievance.get('ai_summary') or ''}"
            ).strip(),
            "risk_assessment": (
                f"Escalation risk is {grievance.get('escalation_risk', 'LOW')}. "
                f"{len(similar_cases)} related case(s) found nearby."
                if similar_cases
                else f"Escalation risk is {grievance.get('escalation_risk', 'LOW')}. No related cases found."
            ),
            "similar_cases": [c.get("grievance_id") for c in similar_cases[:5]],
            "recommended_action": grievance.get("recommended_action")
            or "Review the details and assign to the appropriate field team.",
            "suggested_citizen_response": (
                f"Thank you for reporting this {category} issue. It has been reviewed and "
                f"assigned {('with priority ' + priority.lower()) if priority else ''}. "
                "We will keep you updated as the department works on a resolution."
            ),
            "provider": self.name,
        }

    def chat(self, message: str, language: str = "English", context: str = "") -> str:
        return (
            "CivicAI assistant (offline mode): I can help you understand grievance "
            "categories, track a submitted grievance by its ID, or explain how "
            "department routing works. Connect a real AI provider (OPENAI/GEMINI/GROQ) "
            "for open-ended conversational answers."
        )

    # Offline authenticity read. Deliberately a *different* lens from
    # authenticity_service's rules: those check form (gibberish, GPS sanity,
    # account history), this checks substance — whether the text describes a
    # physical situation a public body could actually go and fix. Two
    # independent estimators are worth merging; one estimator copy-checked
    # against itself is not.
    CIVIC_SITUATION_WORDS = (
        "pothole", "road", "street", "water", "pipe", "leak", "sewage", "drain",
        "garbage", "waste", "trash", "dustbin", "streetlight", "lamp",
        "light", "traffic", "signal", "tree", "wire", "cable", "power", "electric",
        "smoke", "pollution", "dust", "mosquito", "breeding", "overflow", "broken",
        "collapsed", "flood", "waterlogging", "park", "toilet", "bus stop", "school",
        "hospital", "footpath", "pavement", "manhole", "tank", "tap", "tanker",
        "odor", "smell", "noise", "stray", "dog", "rat", "snake", "hazard",
        "crack", "sink", "subside", "blocked", "clog", "stuck", "not working",
    )
    NON_CIVIC_WORDS = (
        "job", "salary", "money", "cash", "loan", "emi", "credit card",
        "vote", "voting", "party", "election", "candidate", "marry", "marriage",
        "love you", "sell", "buy", "offer", "discount", "coupon",
        "hack", "cheat", "birthday", "movie", "song", "game", "free fire",
        "whatsapp", "instagram", "facebook", "youtube", "subscribe", "follow me",
    )
    NAMED_PERSON_PATTERN = re.compile(r"\b(son|daughter|wife|husband|brother|sister)\s+of\b", re.I)

    def assess_authenticity(self, text: str, context_note: str = "") -> dict:
        lowered = (text or "").lower()
        indicators = []

        situation_hits = sorted({w for w in self.CIVIC_SITUATION_WORDS if w in lowered})
        non_civic_hits = sorted({w for w in self.NON_CIVIC_WORDS if w in lowered})

        score = 60

        if situation_hits:
            score += 12 * min(len(situation_hits), 3)
            indicators.append(
                "describes a physical public problem (" + ", ".join(situation_hits[:4]) + ")"
            )
        else:
            score -= 18
            indicators.append("no describable physical public problem")

        if non_civic_hits:
            score -= 25
            indicators.append("about something that is not a civic issue (" + ", ".join(non_civic_hits[:3]) + ")")

        if self.NAMED_PERSON_PATTERN.search(lowered):
            score -= 20
            indicators.append("targets a named person rather than a public problem")

        if len(lowered.split()) < 5 and not situation_hits:
            score -= 12
            indicators.append("too vague to act on")

        score = max(0, min(100, score))

        if score >= 70:
            verdict = "GENUINE"
        elif score >= 45:
            verdict = "SUSPICIOUS"
        else:
            verdict = "LIKELY_FAKE"

        reasoning = (
            f"Offline heuristic read of the complaint's substance: "
            f"{'it names a concrete civic situation' if situation_hits else 'it does not name a concrete civic situation'}"
            f"{'; wording is outside civic scope' if non_civic_hits else ''}. "
            "Confirm against the rule signals before acting."
        )

        return {
            "verdict": verdict,
            "score": score,
            "indicators": indicators,
            "reasoning": reasoning,
            "provider": self.name,
        }


def _extract_json(raw_text: str) -> dict:
    """Best-effort JSON extraction from an LLM response that may include
    markdown code fences or stray text around the JSON object."""
    match = re.search(r"\{.*\}", raw_text, re.DOTALL)
    if not match:
        raise ValueError("No JSON object found in AI response")
    return json.loads(match.group(0))


# The vocabulary authenticity_service expects from any AI provider. Providers
# that answer in their own words are mapped, not rejected — a model saying
# "fake" or "suspicious" plainly means the same thing.
_VERDICT_ALIASES = {
    "GENUINE": "GENUINE",
    "LIKELY_GENUINE": "GENUINE",
    "REAL": "GENUINE",
    "CREDIBLE": "GENUINE",
    "SUSPICIOUS": "SUSPICIOUS",
    "NEEDS_REVIEW": "SUSPICIOUS",
    "UNCLEAR": "SUSPICIOUS",
    "AMBIGUOUS": "SUSPICIOUS",
    "LIKELY_FAKE": "LIKELY_FAKE",
    "FAKE": "LIKELY_FAKE",
    "FABRICATED": "LIKELY_FAKE",
    "NOT_GENUINE": "LIKELY_FAKE",
    "FRAUDULENT": "LIKELY_FAKE",
}


def _normalize_authenticity_read(data: dict, provider_name: str) -> dict:
    """Clamp an LLM's free-form authenticity JSON into the contract
    authenticity_service consumes. Anything unparseable degrades to
    SUSPICIOUS (route it to a human) rather than a silent pass."""
    raw_verdict = str(data.get("verdict") or "").strip().upper().replace("-", "_").replace(" ", "_")
    verdict = _VERDICT_ALIASES.get(raw_verdict, "SUSPICIOUS")

    score = data.get("score")
    try:
        score = max(0, min(100, int(round(float(score)))))
    except (TypeError, ValueError):
        # No usable number: derive a coarse score from the verdict so the
        # fusion step always has something to weight.
        score = {"GENUINE": 80, "SUSPICIOUS": 50, "LIKELY_FAKE": 20}[verdict]

    indicators = data.get("indicators")
    if not isinstance(indicators, list):
        indicators = [str(indicators)] if indicators else []

    return {
        "verdict": verdict,
        "score": score,
        "indicators": [str(i).strip() for i in indicators if str(i).strip()][:6],
        "reasoning": str(data.get("reasoning") or data.get("reason") or "").strip(),
        "provider": provider_name,
    }


class OpenAIProvider(BaseAIProvider):
    name = "openai"
    supports_tools = True
    supports_json_completion = True

    def __init__(self):
        if not settings.OPENAI_API_KEY:
            raise RuntimeError("OPENAI_API_KEY is not configured")
        try:
            from openai import OpenAI  # lazy import, optional dependency
        except ImportError as error:
            raise RuntimeError(
                "The 'openai' package is not installed. Run `pip install openai`."
            ) from error

        self._client = OpenAI(api_key=settings.OPENAI_API_KEY)
        self._model = settings.OPENAI_MODEL

    def _complete(self, prompt: str) -> str:
        response = self._client.chat.completions.create(
            model=self._model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
        )
        return response.choices[0].message.content or ""

    def analyze_grievance(self, text: str, language: str = "English") -> dict:
        prompt = build_analysis_prompt(text, language)

        response = self._client.chat.completions.create(
            model=self._model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
        )
        data = _extract_json(response.choices[0].message.content)
        data["provider"] = self.name
        return data

    def generate_copilot_brief(self, grievance: dict, similar_cases: list) -> dict:
        prompt = (
            "You are an AI Copilot assisting a government grievance officer. "
            "Given the case JSON and related cases, return ONLY JSON with keys "
            "case_summary, risk_assessment, similar_cases (array of ids), "
            "recommended_action, suggested_citizen_response.\n\n"
            f"Case: {json.dumps(grievance, default=str)}\n"
            f"Similar cases: {json.dumps([c.get('grievance_id') for c in similar_cases], default=str)}"
        )
        response = self._client.chat.completions.create(
            model=self._model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
        )
        data = _extract_json(response.choices[0].message.content)
        data["provider"] = self.name
        return data

    def chat(self, message: str, language: str = "English", context: str = "") -> str:
        prompt = (
            "You are CivicAI, a multilingual civic grievance assistant embedded in a "
            "small chat widget. Never invent government policy you don't have context for.\n\n"
            "Formatting rules for this widget:\n"
            "- Answer in 2-5 short sentences by default; only go longer if the question "
            "genuinely needs step-by-step detail.\n"
            "- Do NOT use markdown tables, headers (#), or horizontal rules.\n"
            "- You may use **bold** for key terms and short '-' bullet lists (max 4 items) "
            "when listing distinct things, but prefer plain prose otherwise.\n"
            "- Write like a helpful person texting a quick, clear answer, not a report.\n\n"
            f"Context:\n{context}\n\nUser language: {language}\nUser question: {message}"
        )
        response = self._client.chat.completions.create(
            model=self._model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
        )
        return response.choices[0].message.content

    def chat_with_tools(self, messages: list, tools: list):
        response = self._client.chat.completions.create(
            model=self._model,
            messages=messages,
            tools=tools,
            tool_choice="auto",
            temperature=0.3,
        )
        choice = response.choices[0].message

        if choice.tool_calls:
            return {
                "type": "tool_calls",
                "raw_message": choice,  # provider-native shape, needed to reconstruct history
                "calls": [
                    {"id": tc.id, "name": tc.function.name, "arguments": tc.function.arguments}
                    for tc in choice.tool_calls
                ],
            }
        return {"type": "text", "content": choice.content or ""}

    def append_tool_result(self, messages: list, raw_assistant_message, tool_call_id: str, result_json: str):
        """OpenAI-style history requires the raw assistant tool-call message
        followed by one 'tool' message per call result."""
        if not any(m is raw_assistant_message for m in messages):
            messages.append(raw_assistant_message)
        messages.append({"role": "tool", "tool_call_id": tool_call_id, "content": result_json})


class GeminiProvider(BaseAIProvider):
    name = "gemini"
    supports_json_completion = True

    def __init__(self):
        if not settings.GEMINI_API_KEY:
            raise RuntimeError("GEMINI_API_KEY is not configured")
        try:
            import google.generativeai as genai  # lazy import, optional dependency
        except ImportError as error:
            raise RuntimeError(
                "The 'google-generativeai' package is not installed. "
                "Run `pip install google-generativeai`."
            ) from error

        genai.configure(api_key=settings.GEMINI_API_KEY)
        self._model = genai.GenerativeModel(settings.GEMINI_MODEL)

    def _complete(self, prompt: str) -> str:
        response = self._model.generate_content(prompt)
        return response.text or ""

    def analyze_grievance(self, text: str, language: str = "English") -> dict:
        prompt = build_analysis_prompt(text, language)
        response = self._model.generate_content(prompt)
        data = _extract_json(response.text)
        data["provider"] = self.name
        return data

    def generate_copilot_brief(self, grievance: dict, similar_cases: list) -> dict:
        prompt = (
            "You are an AI Copilot assisting a government grievance officer. "
            "Return ONLY JSON with keys case_summary, risk_assessment, "
            "similar_cases (array of ids), recommended_action, "
            "suggested_citizen_response.\n\n"
            f"Case: {json.dumps(grievance, default=str)}\n"
            f"Similar cases: {json.dumps([c.get('grievance_id') for c in similar_cases], default=str)}"
        )
        response = self._model.generate_content(prompt)
        data = _extract_json(response.text)
        data["provider"] = self.name
        return data

    def chat(self, message: str, language: str = "English", context: str = "") -> str:
        prompt = (
            "You are CivicAI, a multilingual civic grievance assistant embedded in a "
            "small chat widget. Never invent government policy you don't have context for.\n\n"
            "Formatting rules for this widget:\n"
            "- Answer in 2-5 short sentences by default; only go longer if the question "
            "genuinely needs step-by-step detail.\n"
            "- Do NOT use markdown tables, headers (#), or horizontal rules.\n"
            "- You may use **bold** for key terms and short '-' bullet lists (max 4 items) "
            "when listing distinct things, but prefer plain prose otherwise.\n"
            "- Write like a helpful person texting a quick, clear answer, not a report.\n\n"
            f"Context:\n{context}\n\nUser language: {language}\nUser question: {message}"
        )
        response = self._model.generate_content(prompt)
        return response.text


class GroqProvider(BaseAIProvider):
    """
    Groq's API is OpenAI-compatible (same request/response shape), just
    served from a different base URL with Groq-hosted open models (Llama,
    etc). We reuse the `openai` SDK pointed at Groq's endpoint rather than
    duplicating request-building logic.
    """

    name = "groq"
    supports_tools = True
    supports_json_completion = True

    def __init__(self):
        if not settings.GROQ_API_KEY:
            raise RuntimeError("GROQ_API_KEY is not configured")
        try:
            from openai import OpenAI  # lazy import, optional dependency
        except ImportError as error:
            raise RuntimeError(
                "The 'openai' package is not installed. Run `pip install openai`."
            ) from error

        self._client = OpenAI(api_key=settings.GROQ_API_KEY, base_url=settings.GROQ_BASE_URL)
        self._model = settings.GROQ_MODEL

    def _complete(self, prompt: str) -> str:
        response = self._client.chat.completions.create(
            model=self._model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
        )
        return response.choices[0].message.content or ""

    def analyze_grievance(self, text: str, language: str = "English") -> dict:
        prompt = build_analysis_prompt(text, language)
        response = self._client.chat.completions.create(
            model=self._model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
        )
        data = _extract_json(response.choices[0].message.content)
        data["provider"] = self.name
        return data

    def generate_copilot_brief(self, grievance: dict, similar_cases: list) -> dict:
        prompt = (
            "You are an AI Copilot assisting a government grievance officer. "
            "Given the case JSON and related cases, return ONLY JSON with keys "
            "case_summary, risk_assessment, similar_cases (array of ids), "
            "recommended_action, suggested_citizen_response.\n\n"
            f"Case: {json.dumps(grievance, default=str)}\n"
            f"Similar cases: {json.dumps([c.get('grievance_id') for c in similar_cases], default=str)}"
        )
        response = self._client.chat.completions.create(
            model=self._model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
        )
        data = _extract_json(response.choices[0].message.content)
        data["provider"] = self.name
        return data

    def chat(self, message: str, language: str = "English", context: str = "") -> str:
        prompt = (
            "You are CivicAI, a multilingual civic grievance assistant embedded in a "
            "small chat widget. Never invent government policy you don't have context for.\n\n"
            "Formatting rules for this widget:\n"
            "- Answer in 2-5 short sentences by default; only go longer if the question "
            "genuinely needs step-by-step detail.\n"
            "- Do NOT use markdown tables, headers (#), or horizontal rules.\n"
            "- You may use **bold** for key terms and short '-' bullet lists (max 4 items) "
            "when listing distinct things, but prefer plain prose otherwise.\n"
            "- Write like a helpful person texting a quick, clear answer, not a report.\n\n"
            f"Context:\n{context}\n\nUser language: {language}\nUser question: {message}"
        )
        response = self._client.chat.completions.create(
            model=self._model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
        )
        return response.choices[0].message.content

    def chat_with_tools(self, messages: list, tools: list):
        response = self._client.chat.completions.create(
            model=self._model,
            messages=messages,
            tools=tools,
            tool_choice="auto",
            temperature=0.3,
        )
        choice = response.choices[0].message

        if choice.tool_calls:
            return {
                "type": "tool_calls",
                "raw_message": choice,
                "calls": [
                    {"id": tc.id, "name": tc.function.name, "arguments": tc.function.arguments}
                    for tc in choice.tool_calls
                ],
            }
        return {"type": "text", "content": choice.content or ""}

    def append_tool_result(self, messages: list, raw_assistant_message, tool_call_id: str, result_json: str):
        if not any(m is raw_assistant_message for m in messages):
            messages.append(raw_assistant_message)
        messages.append({"role": "tool", "tool_call_id": tool_call_id, "content": result_json})


_provider_instance = None


def get_ai_provider() -> BaseAIProvider:
    """Factory + singleton. Falls back to MockAIProvider if the configured
    real provider cannot be constructed (missing key/package), so the app
    never hard-fails because of AI configuration."""
    global _provider_instance

    if _provider_instance is not None:
        return _provider_instance

    provider_name = settings.AI_PROVIDER

    if provider_name == "openai":
        try:
            _provider_instance = OpenAIProvider()
        except Exception as error:  # noqa: BLE001
            print(f"WARNING: falling back to MockAIProvider (openai init failed: {error})")
            _provider_instance = MockAIProvider()
    elif provider_name == "gemini":
        try:
            _provider_instance = GeminiProvider()
        except Exception as error:  # noqa: BLE001
            print(f"WARNING: falling back to MockAIProvider (gemini init failed: {error})")
            _provider_instance = MockAIProvider()
    elif provider_name == "groq":
        try:
            _provider_instance = GroqProvider()
        except Exception as error:  # noqa: BLE001
            print(f"WARNING: falling back to MockAIProvider (groq init failed: {error})")
            _provider_instance = MockAIProvider()
    else:
        _provider_instance = MockAIProvider()

    return _provider_instance


def analyze_with_fallback(text: str, language: str = "English") -> dict:
    """Runs analysis through the configured provider; if a real provider
    call fails at request time (network error, rate limit, bad response),
    fall back to the mock provider for that single call so the citizen
    workflow never breaks."""
    provider = get_ai_provider()
    try:
        return provider.analyze_grievance(text, language)
    except Exception as error:  # noqa: BLE001
        if provider.name != "mock":
            print(f"WARNING: {provider.name} analyze_grievance failed, using mock: {error}")
            return MockAIProvider().analyze_grievance(text, language)
        raise


_mock_authenticity_provider = None


def assess_authenticity_with_fallback(text: str, context_note: str = "") -> dict:
    """Same fallback contract as analyze_with_fallback, for the authenticity
    read. A misconfigured real provider must not turn fake-grievance
    detection off — the offline heuristic still answers, and the result
    records which provider actually produced it."""
    global _mock_authenticity_provider

    provider = get_ai_provider()
    try:
        result = provider.assess_authenticity(text, context_note)
        if result.get("verdict"):
            return result
        print(f"NOTE: {provider.name} gave no authenticity read; using offline heuristic")
    except Exception as error:  # noqa: BLE001
        print(f"WARNING: {provider.name} assess_authenticity failed, using offline: {error}")

    if _mock_authenticity_provider is None:
        _mock_authenticity_provider = MockAIProvider()
    return _mock_authenticity_provider.assess_authenticity(text, context_note)