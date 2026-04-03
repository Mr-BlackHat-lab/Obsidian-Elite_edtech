from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class Attempt(BaseModel):
    question_id: str
    user_answer: str
    correct: bool
    concept_tag: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class QuestionInSession(BaseModel):
    question_id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    question: str
    type: Literal["mcq", "short_answer"]
    difficulty: Literal["easy", "medium", "hard"]
    options: list[str] = Field(default_factory=list)
    answer: str
    explanation: str
    concept_tag: str


class Session(BaseModel):
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4())[:12])
    user_id: str = "anonymous"
    video_url: str
    transcript: str = ""
    concepts: list[str] = Field(default_factory=list)
    questions: list[QuestionInSession] = Field(default_factory=list)
    attempts: list[Attempt] = Field(default_factory=list)
    score: float = 0.0
    weak_topics: list[str] = Field(default_factory=list)
    source: Literal["recorded", "live"] = "recorded"
    status: Literal["processing", "live", "ready", "failed", "error"] = "processing"
    error: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)


class SubmitAnswerRequest(BaseModel):
    session_id: str
    question_id: str
    user_answer: str
    concept_tag: str


class SubmitAnswerResponse(BaseModel):
    correct: bool
    explanation: str
    updated_score: float
    weak_topics: list[str]


class PerformanceResponse(BaseModel):
    user_id: str
    overall_accuracy: float
    total_sessions: int
    total_questions: int
    topic_breakdown: dict[str, dict[str, Any]]
    weak_topics: list[str]
    feedback: str
    sessions: list[dict[str, Any]]
