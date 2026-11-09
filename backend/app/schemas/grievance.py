from typing import Optional, List
from pydantic import BaseModel, Field, field_validator

from app.utils.constants import DISTRICTS


# How a location got its coordinates — surfaced to staff so an approximate
# or manually-searched pin is never mistaken for an exact GPS fix.
DETECTION_METHODS = {"gps", "search", "manual", "approximate"}


class LocationInput(BaseModel):
    latitude: float
    longitude: float
    address: Optional[str] = None
    # Required, and must be one of the canonical DISTRICTS — this is what
    # actually drives officer routing, so it can't be arbitrary free text.
    district: str = Field(..., min_length=2, max_length=80)

    # Optional structured address parts + provenance. Every grievance stores
    # these when available so the admin map/detail can show city, state,
    # pincode and HOW the point was obtained (spec section 3).
    city: Optional[str] = Field(None, max_length=120)
    state: Optional[str] = Field(None, max_length=120)
    pincode: Optional[str] = Field(None, max_length=12)
    detection_method: Optional[str] = Field(None, max_length=20)

    @field_validator("latitude")
    @classmethod
    def latitude_in_range(cls, value: float) -> float:
        if value < -90 or value > 90:
            raise ValueError("latitude must be between -90 and 90")
        return value

    @field_validator("longitude")
    @classmethod
    def longitude_in_range(cls, value: float) -> float:
        if value < -180 or value > 180:
            raise ValueError("longitude must be between -180 and 180")
        return value

    @field_validator("latitude", "longitude")
    @classmethod
    def reject_null_island(cls, value: float) -> float:
        # (0,0) is the classic "no real location" placeholder (Null Island).
        # Saving it would drop a marker in the Atlantic and misroute reports,
        # so a coordinate pair sitting exactly on 0/0 is rejected up front.
        if value == 0:
            raise ValueError(
                "a latitude/longitude of exactly 0 is not a valid location — "
                "please use your current location or pick a real spot on the map"
            )
        return value

    @field_validator("detection_method")
    @classmethod
    def method_is_known(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        v = value.lower()
        if v not in DETECTION_METHODS:
            raise ValueError(
                f"detection_method must be one of: {', '.join(sorted(DETECTION_METHODS))}"
            )
        return v

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
    # Optional — when the citizen has already pinned a location, passing
    # it lets the preview also check for a matching nearby community
    # incident before they submit (see incident_service.preview_matching_incident).
    location: Optional[LocationInput] = None


class GrievanceStatusUpdate(BaseModel):
    status: str
    message: Optional[str] = None


class ResolutionSubmitRequest(BaseModel):
    resolution_note: str = Field(..., min_length=5, max_length=2000)
    resolution_evidence: List[str] = []

class VerificationRequest(BaseModel):
    verified: bool
    feedback: Optional[str] = None


class ReopenRequestCreate(BaseModel):
    reason: str = Field(..., min_length=10, max_length=1000)


class ReopenReviewRequest(BaseModel):
    approve: bool
    note: Optional[str] = Field(None, max_length=1000)


class AssignOfficerRequest(BaseModel):
    officer_id: str


class BulkGrievanceIdsRequest(BaseModel):
    grievance_ids: List[str] = Field(..., min_length=1, max_length=50)


class BulkAssignRequest(BaseModel):
    grievance_ids: List[str] = Field(..., min_length=1, max_length=50)
    officer_id: str


class FlagInvalidRequest(BaseModel):
    reason: str = Field(..., min_length=5, max_length=500)


class FlagReversalRequest(BaseModel):
    """Staff reversing their own (or a colleague's) false-report flag."""
    note: str = Field(..., min_length=5, max_length=500)


class FlagAppealRequest(BaseModel):
    """The citizen's side of a false-report flag. Bounded well below the
    staff reason length on purpose: an appeal gets read by a human, and a
    wall of text doesn't make an appeal stronger."""
    reason: str = Field(..., min_length=10, max_length=600)


class FlagAppealReviewRequest(BaseModel):
    approve: bool
    note: str = Field(..., min_length=5, max_length=500)


class IntegrityTriageRequest(BaseModel):
    """Officer decision on a case sitting in the integrity queue. This is the
    human answer to the scorer's question, so it's what the score should be
    relearned from — see authenticity_feedback."""
    decision: str = Field(..., pattern="^(GENUINE|FAKE)$")
    note: Optional[str] = Field(None, max_length=500)


class AIAnalyzeRequest(BaseModel):
    text: str = Field(..., min_length=3, max_length=5000)
    language: str = "Auto"


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=3000)
    language: str = "English"
    session_id: Optional[str] = None