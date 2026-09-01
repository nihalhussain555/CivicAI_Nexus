from typing import Optional, List
from pydantic import BaseModel, Field


class DepartmentCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    code: str = Field(..., min_length=2, max_length=20)
    description: str = ""
    categories: List[str] = []


class DepartmentUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    categories: Optional[List[str]] = None
    active: Optional[bool] = None


class OfficerCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    email: str
    password: str = Field(..., min_length=6, max_length=128)
    department: str
    district: str = Field(..., min_length=2, max_length=80)
    specialization: Optional[str] = None
    phone: Optional[str] = None