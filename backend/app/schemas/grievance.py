from typing import Optional, List
from pydantic import BaseModel, Field


class LocationInput(BaseModel):
    latitude: float
    longitude: float
    address: Optional[str] = None


class AttachmentInput(BaseModel):
    url: str
    type: str  # "image" | "audio"
    filename: Optional[str] = None
    ai_description: Optional[str] = None


class GrievanceCreateRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    description: str = Field(..., min_length=5, max_length=5000)
    language: str = "Auto"
    location: Optional[LocationInput] = None
    attachments: List[AttachmentInput] = []
    voice_transcript: Optional[str] = None


class GrievancePreviewRequest(BaseModel):
    """Used for the AI review step before the citizen actually submits."""
    title: str = Field(..., min_length=3, max_length=200)
    description: str = Field(..., min_length=5, max_length=5000)
    language: str = "Auto"


class GrievanceStatusUpdate(BaseModel):
    status: str
    message: Optional[str] = None


class ResolutionSubmitRequest(BaseModel):
    resolution_note: str = Field(..., min_length=5, max_length=2000)
    resolution_evidence: List[str] = []


class VerificationRequest(BaseModel):
    verified: bool
    feedback: Optional[str] = None


class AssignOfficerRequest(BaseModel):
    officer_id: str


class AIAnalyzeRequest(BaseModel):
    text: str = Field(..., min_length=3, max_length=5000)
    language: str = "Auto"


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=3000)
    language: str = "English"
    session_id: Optional[str] = None