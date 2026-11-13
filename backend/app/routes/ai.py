from datetime import datetime

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.config.database import chat_sessions_collection, grievances_collection
from app.config.settings import settings
from app.schemas.grievance import AIAnalyzeRequest, ChatRequest
from app.services.ai_pipeline_service import run_pipeline
from app.services.agent_service import run_agent_chat
from app.services.voice_service import (
    describe_for_user,
    is_issued_audio_url,
    purge_session_recordings,
    transcribe as transcribe_recording,
    voice_preferences,
)
from app.services.voice_service import status as voice_status
from app.utils.dependencies import get_current_user
from app.utils.helpers import serialize_document, serialize_documents
from app.models.chat_session import chat_session_document, make_title


router = APIRouter(prefix="/api/ai", tags=["Artificial Intelligence"])

_MAX_AUDIO_BYTES = settings.MAX_UPLOAD_MB * 1024 * 1024


def _attach_voice_transcript(grievance_id: str, data: ChatRequest, preferences: dict):
    """Keep the speech model's verbatim words on a complaint the citizen
    filed by voice, so an officer can see how it was reported.

    The citizen's approved wording already lives in the title and
    description — this is the machine's guess underneath it, which is why
    `keep_transcript` governs it and why a corrected turn (where the two
    match) stores nothing extra."""
    verbatim = (data.original_text or "").strip()
    if not preferences["keep_transcript"] or not verbatim or verbatim == data.message.strip():
        return
    grievances_collection.update_one(
        {"grievance_id": grievance_id},
        {"$set": {"voice_transcript": verbatim[:5000]}},
    )


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

    agent_result = run_agent_chat(
        data.message, current_user, recent_turns,
        language=data.language,
        pending_complaint=session.get("pending_complaint"),
    )
    response = agent_result["response"]

    user_message = {"role": "user", "text": data.message, "created_at": now}
    preferences = voice_preferences(current_user) if data.source == "voice" else None
    if preferences is not None:
        user_message["source"] = "voice"
        # The citizen's own approved words are the message. What the speech
        # model guessed beforehand, and the recording it came from, are extra
        # and only kept while the account's retention settings allow it.
        if preferences["keep_transcript"] and data.original_text \
                and data.original_text.strip() != data.message.strip():
            user_message["original_text"] = data.original_text.strip()[:5000]
        if preferences["keep_audio"] and is_issued_audio_url(data.audio_url):
            user_message["audio_url"] = data.audio_url
        user_message["language"] = agent_result.get("heard_language")
        user_message["language_code"] = agent_result.get("heard_language_code")

    assistant_message = {
        "role": "assistant",
        "text": response,
        "created_at": datetime.utcnow(),
        "language": agent_result["language"],
        "language_code": agent_result["language_code"],
    }

    update_fields = {"updated_at": datetime.utcnow()}
    if not session["messages"]:
        update_fields["title"] = make_title(data.message)
    # An unanswered preview offer is state, not just chat text: a spoken "yes"
    # two turns later has to file the complaint it referred to.
    update_fields["pending_complaint"] = agent_result.get("pending_complaint")

    chat_sessions_collection.update_one(
        {"_id": session["_id"]},
        {"$push": {"messages": {"$each": [user_message, assistant_message]}}, "$set": update_fields},
    )

    filed_id = agent_result.get("filed_grievance_id")
    if filed_id and preferences is not None:
        _attach_voice_transcript(filed_id, data, preferences)

    return {
        "success": True,
        "data": {
            "response": response,
            "language": agent_result["language"],
            "language_code": agent_result["language_code"],
            "language_source": agent_result["language_source"],
            "heard_language": agent_result.get("heard_language"),
            "heard_language_code": agent_result.get("heard_language_code"),
            "tool_calls": [{"name": t["name"]} for t in agent_result["tool_calls"]],
            "is_ai_generated": True,
            "session_id": str(session["_id"]),
            "awaiting_complaint_confirmation": bool(agent_result.get("pending_complaint")),
            "filed_grievance_id": filed_id,
        },
    }


@router.get("/voice/status")
def assistant_voice_status(current_user=Depends(get_current_user)):
    """What the voice layer can actually do in this deployment, so the
    assistant can offer a microphone honestly and say which languages it can
    speak back."""
    return {"success": True, "data": voice_status()}


@router.post("/voice/transcribe")
async def assistant_voice_transcribe(
    file: UploadFile = File(...),
    language: str = Form("Auto"),
    current_user=Depends(get_current_user),
):
    """Hear a recording and show the citizen what was understood.

    This is the correction step, deliberately separate from sending the
    message: nothing is filed, persisted to a conversation, or classified
    until the citizen has seen the words and agreed they are right."""
    contents = await file.read(_MAX_AUDIO_BYTES + 1)

    try:
        result = transcribe_recording(
            contents, file.filename, file.content_type,
            language=language, user=current_user,
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

    result["summary"] = describe_for_user(result)
    return {"success": True, "data": result}


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
    # "Delete this chat" has to take the recordings with it, otherwise the
    # words go and the voice that said them stays on the server.
    purged = purge_session_recordings(session)
    chat_sessions_collection.delete_one({"_id": session["_id"]})
    return {"success": True, "message": "Chat deleted", "data": {"audio_removed": purged}}