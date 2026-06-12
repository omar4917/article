"""User request/response schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


# ── Requests ───────────────────────────────────────────────────────
class UserCreate(BaseModel):
    """Registration payload."""
    email: EmailStr
    password: str = Field(..., min_length=4, description="User password")
    display_name: str = Field("Editor", min_length=1, max_length=255)


class UserLogin(BaseModel):
    """Login payload."""
    email: EmailStr
    password: str


# ── Responses ──────────────────────────────────────────────────────
class UserResponse(BaseModel):
    """Public user profile."""
    id: str
    email: str
    display_name: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    """JWT token response."""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
