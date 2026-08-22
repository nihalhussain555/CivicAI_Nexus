from fastapi import APIRouter, Depends

from app.schemas.grievance import AIAnalyzeRequest, ChatRequest
from app.services.ai_pipeline_service import run_pipeline
from app.ai.llm import generate_response
from app.services.rag_service import retrieve_context
from app.utils.dependencies import get_current_user


router = APIRouter(prefix="/api/ai", tags=["Artificial Intelligence"])


@router.post("/analyze")
def analyze(data: AIAnalyzeRequest, current_user=Depends(get_current_user)):
    result = run_pipeline(data.text, language=data.language, citizen_id=current_user["_id"])
    result.pop("sla_due_at", None)
    return {"success": True, "data": {**result, "is_ai_generated": True}}


@router.post("/chat")
def chat(data: ChatRequest, current_user=Depends(get_current_user)):
    context_items = retrieve_context(data.message)
    context_text = "\n".join(item["text"] for item in context_items)

    response = generate_response(data.message, language=data.language, context=context_text)

    return {
        "success": True,
        "data": {
            "response": response,
            "sources": [item["source"] for item in context_items],
            "is_ai_generated": True,
        },
    }
