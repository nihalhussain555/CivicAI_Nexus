from datetime import datetime

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException

from app.config.database import chat_sessions_collection
from app.schemas.grievance import AIAnalyzeRequest, ChatRequest
from app.services.ai_pipeline_service import run_pipeline
from app.services.agent_service import run_agent_chat
from app.utils.dependencies import get_current_user
from app.utils.helpers import serialize_document, serialize_documents
from app.models.chat_session import chat_session_document, make_title


router = APIRouter(prefix="/api/ai", tags=["Artificial Intelligence"])


@router.post("/analyze")
def analyze(data: AIAnalyzeRequest, current_user=Depends(get_current_user)):
    result = run_pipeline(data.text, language=data.language, citizen_id=current_user["_id"])
    result.pop("sla_due_at", None)
    return {"success": True, "data": {**result, "is_ai_generated": True}}


def _get_owned_session(session_id: str, user_id):
    try:
        object_id = ObjectId(session_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=404, detail="Chat session not found")

    session = chat_sessions_collection.find_one({"_id": object_id, "user_id": user_id})
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    return session


@router.post("/chat")
def chat(data: ChatRequest, current_user=Depends(get_current_user)):
    now = datetime.utcnow()

    if data.session_id:
        session = _get_owned_session(data.session_id, current_user["_id"])
    else:
        session = chat_session_document(current_user["_id"])
        result = chat_sessions_collection.insert_one(session)
        session["_id"] = result.inserted_id

    # Recent conversation turns, for the agent's short-term memory.
    recent_turns = session["messages"][-12:]

    agent_result = run_agent_chat(data.message, current_user, recent_turns, language=data.language)
    response = agent_result["response"]

    user_message = {"role": "user", "text": data.message, "created_at": now}
    assistant_message = {"role": "assistant", "text": response, "created_at": datetime.utcnow()}

    update_fields = {"updated_at": datetime.utcnow()}
    if not session["messages"]:
        update_fields["title"] = make_title(data.message)

    chat_sessions_collection.update_one(
        {"_id": session["_id"]},
        {"$push": {"messages": {"$each": [user_message, assistant_message]}}, "$set": update_fields},
    )

    return {
        "success": True,
        "data": {
            "response": response,
            "tool_calls": [{"name": t["name"]} for t in agent_result["tool_calls"]],
            "is_ai_generated": True,
            "session_id": str(session["_id"]),
        },
    }


@router.get("/chat/sessions")
def list_chat_sessions(current_user=Depends(get_current_user)):
    sessions = list(
        chat_sessions_collection.find(
            {"user_id": current_user["_id"]},
            {"title": 1, "updated_at": 1, "created_at": 1},
        ).sort("updated_at", -1).limit(50)
    )
    return {"success": True, "data": serialize_documents(sessions)}


@router.get("/chat/sessions/{session_id}")
def get_chat_session(session_id: str, current_user=Depends(get_current_user)):
    session = _get_owned_session(session_id, current_user["_id"])
    return {"success": True, "data": serialize_document(session)}


@router.delete("/chat/sessions/{session_id}")
def delete_chat_session(session_id: str, current_user=Depends(get_current_user)):
    session = _get_owned_session(session_id, current_user["_id"])
    chat_sessions_collection.delete_one({"_id": session["_id"]})
    return {"success": True, "message": "Chat deleted"}