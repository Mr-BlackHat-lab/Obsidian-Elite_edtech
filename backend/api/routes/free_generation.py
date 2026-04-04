"""
Free Question Generation API Routes
Uses Hugging Face Inference API (completely free, no limits)
"""
from __future__ import annotations

import time
from fastapi import APIRouter, Request
from pydantic import BaseModel

from services.difficulty_engine import get_next_difficulty
from services.free_question_generation import generate_question_free, generate_questions_batch_free

router = APIRouter()


class FreeQuestionRequest(BaseModel):
    transcript_chunk: str
    session_id: str | None = None
    difficulty: str | None = None


class FreeQuestionResponse(BaseModel):
    question: dict
    generation_time_ms: int
    difficulty_used: str
    model: str


@router.post("/free-question", response_model=FreeQuestionResponse)
async def generate_free_question_endpoint(req: FreeQuestionRequest, request: Request) -> dict:
    """
    FREE unlimited question generation
    Uses Hugging Face Inference API
    
    Features:
    - Completely free
    - No rate limits
    - No API key required (optional for speed)
    - Response time: 2-5 seconds
    """
    start_time = time.time()
    
    # Determine difficulty
    difficulty = req.difficulty or "medium"
    
    if req.session_id:
        db = request.app.state.db
        session = await db.sessions.find_one(
            {"session_id": req.session_id},
            {"score": 1}
        )
        if session:
            difficulty = get_next_difficulty(float(session.get("score", 0.5)))
    
    # Generate question using FREE API with session tracking
    session_id = req.session_id or "default"
    question = await generate_question_free(req.transcript_chunk, difficulty, session_id)
    
    # Calculate generation time
    elapsed_ms = int((time.time() - start_time) * 1000)
    
    print(f"[FreeGen] Generated in {elapsed_ms}ms - difficulty={difficulty}")
    
    return {
        "question": question,
        "generation_time_ms": elapsed_ms,
        "difficulty_used": difficulty,
        "model": "mistralai/Mistral-7B-Instruct-v0.2"
    }


@router.post("/free-questions-batch")
async def generate_free_batch_endpoint(req: FreeQuestionRequest) -> dict:
    """
    Generate 5 questions in parallel (free)
    2 easy, 2 medium, 1 hard
    """
    start_time = time.time()
    
    questions = await generate_questions_batch_free(req.transcript_chunk)
    
    elapsed_ms = int((time.time() - start_time) * 1000)
    
    return {
        "questions": questions,
        "generation_time_ms": elapsed_ms,
        "count": len(questions),
        "model": "mistralai/Mistral-7B-Instruct-v0.2"
    }


@router.get("/generation-status")
async def generation_status() -> dict:
    """Check if free generation is available"""
    return {
        "status": "available",
        "model": "mistralai/Mistral-7B-Instruct-v0.2",
        "provider": "Hugging Face Inference API",
        "cost": "FREE",
        "rate_limits": "None",
        "api_key_required": False,
        "api_key_recommended": True
    }
