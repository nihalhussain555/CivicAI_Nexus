from typing import Optional, List
from pydantic import BaseModel, Field, field_validator

from app.utils.constants import DISTRICTS


class LocationInput(BaseModel):
    latitude: float
    longitude: float
    address: Optional[str] = None
    # Required, and must be one of the canonical DISTRICTS — this is what
    # actually drives officer routing, so it can't be arbitrary free text.
    district: str = Field(..., min_length=2, max_length=80)

    @field_validator("district")
    @classmethod
    def district_must_be_known(cls, value: str) -> str:
        if value not in DISTRICTS:
            raise ValueError(
                f"Unknown district '{value}'. Must be one of: {', '.join(DISTRICTS)}"
            )
        return value


class AttachmentInput(BaseModel):
    url: str
    type: str  # "image" | "audio"
    filename: Optional[str] = None
    ai_description: Optional[str] = None


class GrievanceCreateRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    description: str = Field(..., min_length=5, max_length=5000)
    language: str = "Auto"
    # Required — every grievance must carry a district-verified location so
    # it can be routed to an officer actually responsible for that area.
    location: LocationInput
    attachments: List[AttachmentInput] = []
    voice_transcript: Optional[str] = None


class GrievancePreviewRequest(BaseModel):
    """Used for the AI review step before the citizen actually submits.
    Location isn't required here — this only runs the AI pipeline for
    preview and never persists anything."""
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