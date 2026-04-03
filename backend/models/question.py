from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, Field


class Question(BaseModel):
    question_id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    question: str
    type: Literal["mcq", "short_answer"]
    difficulty: Literal["easy", "medium", "hard"]
    options: list[str] = Field(default_factory=list)
    answer: str
    explanation: str
    concept_tag: str


class QuestionGenerationRequest(BaseModel):
    transcript_chunk: str
    session_id: str | None = None
    difficulty: Literal["easy", "medium", "hard"] | None = None


class QuestionGenerationResponse(BaseModel):
    session_id: str | None = None
    questions: list[Question]
    difficulty_used: str
