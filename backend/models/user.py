from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class User(BaseModel):
    user_id: str = Field(default_factory=lambda: str(uuid.uuid4())[:12])
    username: str
    email: str = ""
    password_hash: str = ""
    auth_provider: str = "local"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    total_sessions: int = 0
    overall_score: float = 0.0


class UserCreateRequest(BaseModel):
    username: str
    email: str = ""
    password: str


class UserUpdateRequest(BaseModel):
    username: str | None = None
    email: str | None = None
    password: str | None = None
