import os
import asyncio

from celery import Celery
from motor.motor_asyncio import AsyncIOMotorClient

redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
mongodb_url = os.getenv("MONGODB_URL", "mongodb://mongo:27017/learnpulse")
free_tier_mode = os.getenv("FREE_TIER_MODE", "true").lower() in {"1", "true", "yes", "on"}
max_chunks = int(os.getenv("MAX_CHUNKS_PER_VIDEO", "1" if free_tier_mode else "3"))
max_questions = int(os.getenv("MAX_QUESTIONS_PER_SESSION", "5" if free_tier_mode else "15"))
app = Celery("learnpulse", broker=redis_url, backend=redis_url)


@app.task(name="workers.celery_tasks.ping")
def ping() -> str:
    return "pong"


@app.task(bind=True, max_retries=3, name="workers.celery_tasks.process_video_task")
def process_video_task(self, session_id: str, video_url: str) -> None:
    """Process a video in background and persist transcript/questions in MongoDB."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        from services.concept_extraction import extract_concepts
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

        cached = loop.run_until_complete(_load_cached_ready())
        if cached:
            async def _persist_cached() -> None:
                client = AsyncIOMotorClient(mongodb_url)
                try:
                    db_name = mongodb_url.rsplit("/", 1)[-1] if "/" in mongodb_url else "learnpulse"
                    db = client[db_name]
                    await db.sessions.update_one(
                        {"session_id": session_id},
                        {
                            "$set": {
                                "transcript": cached.get("transcript", ""),
                                "concepts": cached.get("concepts", []),
                                "questions": cached.get("questions", [])[:max_questions],
                                "status": "ready",
                                "cache_hit": True,
                            }
                        },
                    )
                finally:
                    client.close()

            loop.run_until_complete(_persist_cached())
            return

        transcript = loop.run_until_complete(get_transcript(video_url))
        chunks = chunk_transcript(transcript, chunk_size=500)

        concepts: list[str] = []
        questions: list[dict] = []

        for chunk in chunks[:max_chunks]:
            concepts.extend(extract_concepts(chunk))
            chunk_questions = loop.run_until_complete(generate_questions(chunk))
            for item in chunk_questions:
                if isinstance(item, dict):
                    questions.append(item)
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

    except Exception as exc:  # pragma: no cover - task retry path
        raise self.retry(exc=exc, countdown=10)
    finally:
        loop.close()
