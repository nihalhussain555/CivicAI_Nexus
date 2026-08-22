"""
Thin wrapper kept for backward compatibility with existing imports
(`from app.ai.llm import generate_response`). Delegates to the provider
abstraction in app/ai/provider.py so /api/ai/chat uses whichever provider
is configured (mock/openai/gemini) exactly like grievance analysis does.
"""

from app.ai.provider import get_ai_provider, MockAIProvider


def generate_response(prompt: str, language: str = "English", context: str = "") -> str:
    provider = get_ai_provider()
    try:
        return provider.chat(prompt, language=language, context=context)
    except Exception as error:  # noqa: BLE001
        if provider.name != "mock":
            print(f"WARNING: {provider.name} chat failed, using mock: {error}")
            return MockAIProvider().chat(prompt, language=language, context=context)
        raise
