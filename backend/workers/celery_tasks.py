import os
import asyncio
import sys
import json
from pathlib import Path

from celery import Celery
from motor.motor_asyncio import AsyncIOMotorClient
from redis import Redis
from redis.exceptions import RedisError

redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
mongodb_url = os.getenv("MONGODB_URL", "mongodb://mongo:27017/learnpulse")
free_tier_mode = os.getenv("FREE_TIER_MODE", "true").lower() in {"1", "true", "yes", "on"}
max_chunks = int(os.getenv("MAX_CHUNKS_PER_VIDEO", "1" if free_tier_mode else "3"))
max_questions = int(os.getenv("MAX_QUESTIONS_PER_SESSION", "5" if free_tier_mode else "15"))
concept_similarity_threshold = float(os.getenv("CONCEPT_SIMILARITY_THRESHOLD", "0.85"))
video_question_cache_ttl = int(os.getenv("VIDEO_QUESTION_CACHE_TTL", "86400"))
app = Celery("learnpulse", broker=redis_url, backend=redis_url)


def _video_question_cache_key(video_url: str) -> str:
    return f"videoq:{video_url}"


def _load_cached_questions(video_url: str) -> list[dict] | None:
    try:
        client = Redis.from_url(redis_url, decode_responses=True)
        raw = client.get(_video_question_cache_key(video_url))
        client.close()
        if not raw:
            return None
        data = json.loads(raw)
        if isinstance(data, list):
            return [item for item in data if isinstance(item, dict)]
    except (RedisError, json.JSONDecodeError):
        return None
    return None


def _save_cached_questions(video_url: str, questions: list[dict]) -> None:
    try:
        client = Redis.from_url(redis_url, decode_responses=True)
        client.setex(_video_question_cache_key(video_url), video_question_cache_ttl, json.dumps(questions))
        client.close()
    except (RedisError, TypeError):
        return


def _is_valid_question(item: dict) -> bool:
    required = {
        "question_id",
        "question",
        "type",
        "difficulty",
        "options",
        "answer",
        "explanation",
        "concept_tag",
    }
    if not required.issubset(set(item.keys())):
        return False
    if item.get("type") not in {"mcq", "short_answer"}:
        return False
    if item.get("difficulty") not in {"easy", "medium", "hard"}:
        return False
    if not isinstance(item.get("options"), list):
        return False
    return True


def _ensure_app_root_on_path() -> None:
    """Make sure /app is on sys.path for Celery worker child processes."""
    app_root = str(Path(__file__).resolve().parents[1])
    if app_root not in sys.path:
        sys.path.insert(0, app_root)


@app.task(name="workers.celery_tasks.ping")
def ping() -> str:
    return "pong"


@app.task(bind=True, max_retries=3, name="workers.celery_tasks.process_video_task")
def process_video_task(self, session_id: str, video_url: str) -> None:
    """Process a video in background and persist transcript/questions in MongoDB."""
    _ensure_app_root_on_path()
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        from services.concept_extraction import SessionConceptIndex, extract_concepts
        from services.question_generation import generate_questions
        from services.transcription import chunk_transcript, get_transcript

        async def _load_cached_ready() -> dict | None:
            client = AsyncIOMotorClient(mongodb_url)
            try:
                db_name = mongodb_url.rsplit("/", 1)[-1] if "/" in mongodb_url else "learnpulse"
                db = client[db_name]
                return await db.sessions.find_one(
                    {
                        "video_url": video_url,
                        "status": "ready",
                        "transcript": {"$ne": ""},
                        "questions.0": {"$exists": True},
                    },
                    sort=[("created_at", -1)],
                    projection={"_id": 0, "transcript": 1, "concepts": 1, "questions": 1},
                )
            finally:
                client.close()

        # Stage-6: Redis cache to skip repeated LLM work for same video_url.
        redis_cached_questions = _load_cached_questions(video_url)
        if redis_cached_questions:
            async def _persist_redis_cached() -> None:
                client = AsyncIOMotorClient(mongodb_url)
                try:
                    db_name = mongodb_url.rsplit("/", 1)[-1] if "/" in mongodb_url else "learnpulse"
                    db = client[db_name]
                    await db.sessions.update_one(
                        {"session_id": session_id},
                        {
                            "$set": {
                                "questions": redis_cached_questions[:max_questions],
                                "status": "ready",
                                "cache_hit": True,
                                "cache_source": "redis",
                            }
                        },
                    )
                finally:
                    client.close()

            loop.run_until_complete(_persist_redis_cached())
            return

        cached = loop.run_until_complete(_load_cached_ready())
        if cached:
            async def _persist_cached() -> None:
                client = AsyncIOMotorClient(mongodb_url)
                try:
                    db_name = mongodb_url.rsplit("/", 1)[-1] if "/" in mongodb_url else "learnpulse"
                    db = client[db_name]
                    cached_questions = []
                    for q in cached.get("questions", []):
                        if isinstance(q, dict):
                            safe = dict(q)
                            safe["concept_tag"] = str(safe.get("concept_tag", "general")).strip().lower() or "general"
                            cached_questions.append(safe)

                    await db.sessions.update_one(
                        {"session_id": session_id},
                        {
                            "$set": {
                                "transcript": cached.get("transcript", ""),
                                "concepts": cached.get("concepts", []),
                                "questions": cached_questions[:max_questions],
                                "status": "ready",
                                "cache_hit": True,
                                "cache_source": "mongo",
                            }
                        },
                    )
                finally:
                    client.close()

            loop.run_until_complete(_persist_cached())
            return

        transcript = loop.run_until_complete(get_transcript(video_url))
        chunks = chunk_transcript(transcript, chunk_size=500)

        concept_index = SessionConceptIndex()
        concepts: list[str] = []
        questions: list[dict] = []
        asked_concepts: set[str] = set()

        for chunk in chunks[:max_chunks]:
            chunk_concepts = extract_concepts(chunk)
            for concept in chunk_concepts:
                if concept_index.is_new_concept(concept, threshold=concept_similarity_threshold):
                    concept_index.add_concept(concept)
                    concepts.append(concept)

            chunk_questions = loop.run_until_complete(generate_questions(chunk))
            for item in chunk_questions:
                if isinstance(item, dict):
                    question = dict(item)
                    concept_tag = str(question.get("concept_tag", "")).strip().lower()

                    # Ensure every saved question has a non-empty concept tag.
                    if not concept_tag or concept_tag == "general":
                        concept_tag = (chunk_concepts[0].lower() if chunk_concepts else "general")
                    question["concept_tag"] = concept_tag

                    # Stage-2 dedup: avoid asking the same concept twice in one session.
                    if concept_tag in asked_concepts:
                        continue

                    # Stage-6: filter malformed question objects before saving.
                    if not _is_valid_question(question):
                        continue

                    asked_concepts.add(concept_tag)
                    questions.append(question)
                if len(questions) >= max_questions:
                    break
            if len(questions) >= max_questions:
                break

        async def _persist() -> None:
            client = AsyncIOMotorClient(mongodb_url)
            try:
                db_name = mongodb_url.rsplit("/", 1)[-1] if "/" in mongodb_url else "learnpulse"
                db = client[db_name]
                await db.sessions.update_one(
                    {"session_id": session_id},
                    {
                        "$set": {
                            "transcript": transcript,
                            "concepts": sorted(set(concepts)),
                            "questions": questions,
                            "status": "ready",
                        }
                    },
                )
            finally:
                client.close()

        loop.run_until_complete(_persist())
        if questions:
            _save_cached_questions(video_url, questions)

    except Exception as exc:  # pragma: no cover - task retry path
        raise self.retry(exc=exc, countdown=10)
    finally:
        loop.close()
