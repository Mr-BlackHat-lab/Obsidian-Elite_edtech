from __future__ import annotations

import base64
import datetime
import json
import os
import time
import uuid

from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from services.concept_extraction import SessionConceptIndex, extract_concepts
from services.difficulty_engine import get_next_difficulty
from services.question_generation import generate_question_async, generate_questions
from services.live_stream import (
    check_whisper_available,
    get_full_buffer_text,
    load_asked_concepts,
    mark_concept_asked,
    save_chunk_to_buffer,
    should_trigger_quiz,
    transcribe_chunk_live,
)
from workers.celery_tasks import process_video_task

router = APIRouter()
_active_live_sessions: dict[str, WebSocket] = {}
LIVE_TRANSCRIBE_MERGE_CHUNKS = max(1, int(os.getenv("LIVE_TRANSCRIBE_MERGE_CHUNKS", "3")))


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


@router.websocket("/ws/live")
async def live_stream_websocket(
    websocket: WebSocket,
    session_id: str,
    user_id: str = "anonymous",
    video_url: str = "",
):
    """Live video pipeline websocket receiving audio chunks and sending quiz prompts."""
    previous = _active_live_sessions.get(session_id)
    if previous is not None:
        try:
            await previous.close(code=1012, reason="Superseded by a newer connection")
        except Exception:
            pass

    await websocket.accept()
    _active_live_sessions[session_id] = websocket

    # Fail fast if Whisper or ffmpeg is missing
    whisper_ok, whisper_err = check_whisper_available()
    if not whisper_ok:
        await websocket.send_json({"type": "ERROR", "code": "WHISPER_UNAVAILABLE", "message": whisper_err})
        await websocket.close(code=1011, reason=whisper_err)
        _active_live_sessions.pop(session_id, None)
        return

    print(f"[WS] Live session started: {session_id} (user={user_id})")

    # Upsert live session document in MongoDB on connect
    db = websocket.app.state.db
    await db.sessions.update_one(
        {"session_id": session_id},
        {
            "$setOnInsert": {
                "session_id": session_id,
                "user_id": user_id,
                "video_url": video_url,
                "transcript": "",
                "concepts": [],
                "questions": [],
                "attempts": [],
                "score": 0.0,
                "weak_topics": [],
                "source": "live",
                "created_at": datetime.datetime.utcnow(),
            },
            "$set": {"status": "live"},
        },
        upsert=True,
    )

    concept_index = SessionConceptIndex()
    asked_concepts = await load_asked_concepts(session_id)
    for concept in asked_concepts:
        concept_index.add_concept(concept)
    recent_audio_chunks: list[bytes] = []

    # Allow the first quiz without waiting the full interval, then enforce interval.
    last_quiz_time = time.time() - 120

    try:
        while True:
            payload = await websocket.receive()

            if payload.get("type") == "websocket.disconnect":
                break

            if payload.get("bytes") is not None:
                audio_bytes = payload["bytes"]
            else:
                text_message = payload.get("text")
                if text_message is None:
                    continue

                try:
                    data = json.loads(text_message)
                except json.JSONDecodeError:
                    # Stage-1 ping/pong scaffold support for quick manual checks.
                    if text_message.lower().strip() == "hello":
                        print(f"[WS] hello from session {session_id}")
                    continue

                msg_type = str(data.get("type", "")).lower()
                if msg_type == "ping":
                    await websocket.send_json({"type": "pong", "session_id": session_id})
                    continue
                if msg_type == "hello":
                    print(f"[WS] hello from extension for session {session_id}")
                    continue

                audio_base64 = data.get("audio_base64")
                if not isinstance(audio_base64, str) or not audio_base64:
                    continue

                try:
                    audio_bytes = base64.b64decode(audio_base64)
                except Exception:
                    continue

            if not audio_bytes:
                continue

            recent_audio_chunks.append(audio_bytes)
            if len(recent_audio_chunks) > LIVE_TRANSCRIBE_MERGE_CHUNKS:
                recent_audio_chunks = recent_audio_chunks[-LIVE_TRANSCRIBE_MERGE_CHUNKS:]

            audio_candidates = [audio_bytes]
            max_merge = min(len(recent_audio_chunks), LIVE_TRANSCRIBE_MERGE_CHUNKS)
            for merge_size in range(2, max_merge + 1):
                audio_candidates.append(b"".join(recent_audio_chunks[-merge_size:]))

            chunk_text = ""
            chunk_started = time.time()
            for candidate in audio_candidates:
                chunk_text = await transcribe_chunk_live(candidate)
                if chunk_text.strip():
                    break
            chunk_latency = time.time() - chunk_started
            print(
                f"[WS] Chunk transcribed in {chunk_latency:.2f}s for {session_id} "
                f"(candidates={len(audio_candidates)})"
            )

            if not chunk_text.strip():
                continue

            await save_chunk_to_buffer(session_id, chunk_text)

            if not should_trigger_quiz(last_quiz_time):
                continue

            rolling_text = await get_full_buffer_text(session_id)
            if not rolling_text.strip():
                continue

            concepts = extract_concepts(rolling_text)
            new_concept = None
            for concept in concepts:
                if concept in asked_concepts:
                    continue
                if concept_index.is_new_concept(concept):
                    new_concept = concept
                    break

            if not new_concept:
                continue

            difficulty = "medium"
            try:
                session = await db.sessions.find_one({"session_id": session_id}, {"score": 1})
                if session:
                    difficulty = get_next_difficulty(float(session.get("score", 0.0)))
            except Exception:
                pass

            question = await generate_question_async(rolling_text, difficulty=difficulty)
            question["triggered_by"] = new_concept

            await mark_concept_asked(session_id, new_concept)
            asked_concepts.add(new_concept)
            concept_index.add_concept(new_concept)
            last_quiz_time = time.time()

            await websocket.send_json(
                {
                    "type": "SHOW_QUIZ",
                    "question": question,
                    "session_id": session_id,
                }
            )
            print(f"[WS] Quiz sent for concept={new_concept} session={session_id}")
    except WebSocketDisconnect:
        print(f"[WS] Session disconnected: {session_id}")
    except Exception as exc:
        print(f"[WS] Unexpected error in session {session_id}: {exc}")
        try:
            await websocket.close(code=1011, reason="Internal server error")
        except Exception:
            pass
    finally:
        if _active_live_sessions.get(session_id) is websocket:
            _active_live_sessions.pop(session_id, None)
        # Persist accumulated transcript and mark session ready
        try:
            full_text = await get_full_buffer_text(session_id)
            if full_text.strip():
                concepts = extract_concepts(full_text)
                await db.sessions.update_one(
                    {"session_id": session_id},
                    {"$set": {
                        "transcript": full_text,
                        "concepts": sorted(set(concepts)),
                        "status": "ready",
                    }},
                )
        except Exception as persist_exc:
            print(f"[WS] Failed to persist live transcript for {session_id}: {persist_exc}")
