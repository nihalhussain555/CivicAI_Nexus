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
from app.services.classification_service import classify_complaint
from app.services.priority_service import predict_priority
from app.services.sentiment_service import analyze_sentiment


ANALYSIS_JSON_SCHEMA_HINT = """
Return ONLY a JSON object (no markdown, no commentary) with exactly these keys:
{
  "category": string,
  "subcategory": string or null,
  "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "urgency_score": integer 0-100,
  "priority": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "priority_score": integer 0-100,
  "confidence": number 0-1,
  "sentiment": "POSITIVE" | "NEUTRAL" | "NEGATIVE",
  "recommended_department": string,
  "summary": string (1-2 sentences, plain language),
  "recommended_action": string (1 sentence, actionable for a government officer)
}
"""


class BaseAIProvider(ABC):
    name = "base"

    @abstractmethod
    def analyze_grievance(self, text: str, language: str = "English") -> dict:
        ...

    @abstractmethod
    def generate_copilot_brief(self, grievance: dict, similar_cases: list) -> dict:
        ...

    @abstractmethod
    def chat(self, message: str, language: str = "English", context: str = "") -> str:
        ...


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
            "department routing works. Connect a real AI provider (OPENAI/GEMINI) "
            "for open-ended conversational answers."
        )


def _extract_json(raw_text: str) -> dict:
    """Best-effort JSON extraction from an LLM response that may include
    markdown code fences or stray text around the JSON object."""
    match = re.search(r"\{.*\}", raw_text, re.DOTALL)
    if not match:
        raise ValueError("No JSON object found in AI response")
    return json.loads(match.group(0))


class OpenAIProvider(BaseAIProvider):
    name = "openai"

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

    def analyze_grievance(self, text: str, language: str = "English") -> dict:
        prompt = (
            "You are CivicAI, an AI system that triages citizen civic grievances "
            "for a government department. Analyze the grievance below and produce "
            f"structured output. {ANALYSIS_JSON_SCHEMA_HINT}\n\n"
            f"Language: {language}\nGrievance text:\n{text}"
        )

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
            "You are CivicAI, a multilingual civic grievance assistant. "
            "Never invent government policy you don't have context for. "
            f"Context:\n{context}\n\nUser language: {language}\nUser question: {message}"
        )
        response = self._client.chat.completions.create(
            model=self._model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
        )
        return response.choices[0].message.content


class GeminiProvider(BaseAIProvider):
    name = "gemini"

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

    def analyze_grievance(self, text: str, language: str = "English") -> dict:
        prompt = (
            "You are CivicAI, an AI system that triages citizen civic grievances "
            "for a government department. Analyze the grievance below and produce "
            f"structured output. {ANALYSIS_JSON_SCHEMA_HINT}\n\n"
            f"Language: {language}\nGrievance text:\n{text}"
        )
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
            "You are CivicAI, a multilingual civic grievance assistant. "
            "Never invent government policy you don't have context for. "
            f"Context:\n{context}\n\nUser language: {language}\nUser question: {message}"
        )
        response = self._model.generate_content(prompt)
        return response.text


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
