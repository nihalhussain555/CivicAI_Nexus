from app.config.settings import settings


def generate_response(prompt):

    """
    LLM adapter.

    The backend works without an external LLM.

    Later connect:
    - OpenAI
    - Gemini
    - Groq
    - Ollama
    - another compatible provider
    """

    if not settings.LLM_API_KEY:

        return (
            "CivicAI AI service is currently "
            "running in local assistant mode. "
            "Your question has been received, "
            "but an external LLM provider has "
            "not been configured yet."
        )

    return (
        "LLM provider configuration detected. "
        "Connect your selected provider inside "
        "app/ai/llm.py."
    )