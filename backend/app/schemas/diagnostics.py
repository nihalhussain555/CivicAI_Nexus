from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator

# Everything here arrives from a browser, so every field is length-capped and
# the note is scrubbed before storage — an error log is a prime spot for
# someone to paste a script or a credential and have it rendered to an admin.


class ClientErrorRequest(BaseModel):
    feature: str = Field(default="unknown", max_length=64)
    category: Optional[str] = Field(default=None, max_length=32)
    message: str = Field(..., min_length=1, max_length=600)
    severity: Optional[str] = Field(default=None, max_length=16)
    error_ref: Optional[str] = Field(default=None, max_length=64)
    path: Optional[str] = Field(default=None, max_length=200)
    occurred_at: Optional[str] = Field(default=None, max_length=40)
    context: Optional[Dict[str, Any]] = None

    @field_validator("context")
    @classmethod
    def _trim_context(cls, value):
        if not value:
            return {}
        # Keep it to small scalars: no request bodies, no tokens, no blobs.
        safe = {}
        for key, item in list(value.items())[:12]:
            if isinstance(item, (str, int, float, bool)) or item is None:
                safe[str(key)[:40]] = str(item)[:200]
        return safe


class IssueReportRequest(BaseModel):
    note: str = Field(..., min_length=3, max_length=2000)
    feature: str = Field(default="unknown", max_length=64)
    category: Optional[str] = Field(default=None, max_length=32)
    message: Optional[str] = Field(default=None, max_length=600)
    error_ref: Optional[str] = Field(default=None, max_length=64)
    path: Optional[str] = Field(default=None, max_length=200)
    steps: Optional[List[str]] = Field(default=None, max_length=10)
    context: Optional[Dict[str, Any]] = None

    @field_validator("steps")
    @classmethod
    def _clean_steps(cls, value):
        if not value:
            return []
        return [str(step).strip()[:300] for step in value if str(step).strip()][:10]


class EventStatusRequest(BaseModel):
    # Either one event, or every occurrence of a distinct failure.
    event_ids: Optional[List[str]] = Field(default=None, max_length=200)
    fingerprint: Optional[str] = Field(default=None, max_length=64)
    status: str = Field(..., min_length=1, max_length=16)
