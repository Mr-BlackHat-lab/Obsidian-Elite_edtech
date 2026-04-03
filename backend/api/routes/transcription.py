from __future__ import annotations

import datetime
import uuid

from fastapi import APIRouter, Request
from pydantic import BaseModel

from services.difficulty_engine import get_next_difficulty
from services.question_generation import generate_question_async, generate_questions
from workers.celery_tasks import process_video_task

router = APIRouter()


class TranscribeRequest(BaseModel):
    video_url: str
    user_id: str = "anonymous"


class GenerateQuestionsRequest(BaseModel):
    transcript_chunk: str
    session_id: str | None = None
    difficulty: str | None = None


@router.post("/transcribe")
async def transcribe(req: TranscribeRequest, request: Request) -> dict:
    db = request.app.state.db

    existing = await db.sessions.find_one(
        {
            "video_url": req.video_url,
            "user_id": req.user_id,
            "status": {"$in": ["processing", "ready"]},
        },
        sort=[("created_at", -1)],
        projection={"_id": 0, "session_id": 1, "status": 1},
    )
    if existing:
        return {
            "session_id": existing["session_id"],
            "status": existing["status"],
            "reused": True,
        }

    session_id = str(uuid.uuid4())[:12]

    await db.sessions.insert_one(
        {
            "session_id": session_id,
            "user_id": req.user_id,
            "video_url": req.video_url,
            "transcript": "",
            "concepts": [],
            "questions": [],
            "attempts": [],
            "score": 0.0,
            "weak_topics": [],
            "status": "processing",
            "source": "recorded",
            "created_at": datetime.datetime.utcnow(),
        }
    )

    process_video_task.delay(session_id, req.video_url)
    return {"session_id": session_id, "status": "processing", "reused": False}


@router.post("/generate-questions")
async def generate_questions_endpoint(req: GenerateQuestionsRequest, request: Request) -> dict:
    db = request.app.state.db

    difficulty = req.difficulty or "medium"
    if req.session_id:
        session = await db.sessions.find_one({"session_id": req.session_id})
        if session:
            difficulty = get_next_difficulty(float(session.get("score", 0.0)))

    # Session-aware path: generate a single question at adaptive difficulty.
    if req.session_id:
        questions = [await generate_question_async(req.transcript_chunk, difficulty=difficulty)]
    else:
        questions = await generate_questions(req.transcript_chunk)

    return {
        "session_id": req.session_id,
        "questions": questions,
        "difficulty_used": difficulty,
    }
