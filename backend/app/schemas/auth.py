from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    language: str = "English"
    phone: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class NotificationPreferences(BaseModel):
    email: Optional[bool] = None
    in_app: Optional[bool] = None


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    language: Optional[str] = None
    date_of_birth: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    profile_image: Optional[str] = None
    notification_preferences: Optional[NotificationPreferences] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6, max_length=128)