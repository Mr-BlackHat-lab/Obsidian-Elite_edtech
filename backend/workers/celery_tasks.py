import os
import asyncio
import sys
import json
from pathlib import Path
from urllib.parse import quote_plus
from urllib.request import Request, urlopen

from celery import Celery
from celery.exceptions import MaxRetriesExceededError
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


def _looks_like_fallback_questions(questions: list[dict]) -> bool:
    if not questions:
        return False
    fallback_markers = {
        "This fallback answer is used when AI generation is unavailable.",
        "Option A",
        "Option B",
        "Option C",
        "Option D",
    }
    first = questions[0] if isinstance(questions[0], dict) else {}
    explanation = str(first.get("explanation", "")).strip()
    return explanation in fallback_markers or str(first.get("concept_tag", "")).strip().lower() == "general"


def _demo_questions(video_url: str) -> list[dict]:
    video_label = video_url.split("watch?v=")[-1] if "watch?v=" in video_url else video_url.rsplit("/", 1)[-1]
    video_label = video_label[:40] or "the video"
    return [
        {
            "question_id": "demo_q1",
            "question": f"What is the main purpose of Docker volumes in {video_label}?",
            "type": "mcq",
            "difficulty": "easy",
            "options": [
                "To persist data beyond the container lifecycle",
                "To replace the Docker image",
                "To slow down the container",
                "To stop all networking",
            ],
            "answer": "A",
            "explanation": "Docker volumes are used to persist and share data outside the container lifecycle.",
            "concept_tag": "docker fundamentals",
        },
        {
            "question_id": "demo_q2",
            "question": "What does Kubernetes primarily orchestrate?",
            "type": "mcq",
            "difficulty": "easy",
            "options": [
                "Pods and services",
                "Only static web pages",
                "Local text files",
                "Single Python functions",
            ],
            "answer": "A",
            "explanation": "Kubernetes orchestrates containerized workloads such as pods and services.",
            "concept_tag": "kubernetes basics",
        },
        {
            "question_id": "demo_q3",
            "question": "Which option best describes a container image?",
            "type": "mcq",
            "difficulty": "medium",
            "options": [
                "A runnable package with app and dependencies",
                "A cloud backup service",
                "A network cable",
                "A user profile",
            ],
            "answer": "A",
            "explanation": "A container image packages the application and dependencies needed to run it.",
            "concept_tag": "containers",
        },
    ]


def _metadata_transcript(video_url: str) -> str:
    """Build a lightweight transcript proxy from public YouTube metadata."""
    try:
        oembed_url = (
            "https://www.youtube.com/oembed"
            f"?url={quote_plus(video_url)}&format=json"
        )
        req = Request(oembed_url, headers={"User-Agent": "LearnPulse/1.0"})
        with urlopen(req, timeout=10) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except Exception:
        return ""

    title = str(payload.get("title", "")).strip()
    author = str(payload.get("author_name", "")).strip()
    if not title:
        return ""

    return (
        f"Video title: {title}. "
        f"Channel: {author}. "
        "Generate practical learning questions based on the likely concepts in this video topic."
    )


def _cheap_concepts(text: str) -> list[str]:
    """Fast concept tags without loading transformer models."""
    stop = {
        "video", "title", "channel", "generate", "practical", "learning", "questions",
        "based", "likely", "concepts", "this", "that", "with", "from", "about", "for",
        "and", "the", "are", "your", "you", "into", "using",
    }
    tokens = []
    for raw in text.lower().replace(".", " ").replace(":", " ").split():
        token = "".join(ch for ch in raw if ch.isalnum() or ch in {"-", "_"})
        if len(token) < 4 or token in stop:
            continue
        if token not in tokens:
            tokens.append(token)
        if len(tokens) >= 5:
            break
    return tokens or ["general"]


def _load_cached_questions(video_url: str) -> list[dict] | None:
    try:
        client = Redis.from_url(redis_url, decode_responses=True)
        raw = client.get(_video_question_cache_key(video_url))
        client.close()
        if not raw:
            return None
        data = json.loads(raw)
        if isinstance(data, list):
            questions = [item for item in data if isinstance(item, dict)]
            return None if _looks_like_fallback_questions(questions) else questions
    except (RedisError, json.JSONDecodeError):
        return None
    return None


def _is_fallback_session(session: dict | None) -> bool:
    if not session:
        return False
    questions = session.get("questions", [])
    if not isinstance(questions, list) or not questions:
        return False
    return _looks_like_fallback_questions([item for item in questions if isinstance(item, dict)])


def _save_cached_questions(video_url: str, questions: list[dict]) -> None:
    if _looks_like_fallback_questions(questions):
        return
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
    if str(item.get("type", "")).strip().lower() != "mcq":
        return False
    if item.get("difficulty") not in {"easy", "medium", "hard"}:
        return False
    options = item.get("options")
    if not isinstance(options, list):
        return False
    normalized_options = [str(opt).strip() for opt in options if str(opt).strip()]
    if len(normalized_options) < 4:
        return False

    answer = str(item.get("answer", "")).strip().upper()
    if answer not in {"A", "B", "C", "D"}:
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
        if cached and not _is_fallback_session(cached):
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

        generation_source = "transcript"
        try:
            transcript = loop.run_until_complete(get_transcript(video_url))
        except ValueError as exc:
            transcript = _metadata_transcript(video_url)
            if transcript:
                generation_source = "metadata_fallback"
            else:
                generation_source = "demo_fallback"

            if transcript:
                # Continue the normal question-generation pipeline using metadata-derived context.
                pass
            else:
                async def _mark_failed() -> None:
                    client = AsyncIOMotorClient(mongodb_url)
                    try:
                        db_name = mongodb_url.rsplit("/", 1)[-1] if "/" in mongodb_url else "learnpulse"
                        db = client[db_name]
                        await db.sessions.update_one(
                            {"session_id": session_id},
                            {
                                "$set": {
                                    "status": "ready",
                                    "error": str(exc),
                                    "transcript": "",
                                    "concepts": ["docker fundamentals", "kubernetes basics", "containers"],
                                    "questions": _demo_questions(video_url),
                                    "generation_source": "demo_fallback",
                                    "cache_hit": False,
                                    "cache_source": "demo_fallback",
                                }
                            },
                        )
                    finally:
                        client.close()
                loop.run_until_complete(_mark_failed())
                return
        chunks = chunk_transcript(transcript, chunk_size=500)

        use_lightweight_concepts = generation_source == "metadata_fallback"
        concept_index = None if use_lightweight_concepts else SessionConceptIndex()
        concepts: list[str] = []
        questions: list[dict] = []
        asked_concepts: set[str] = set()

        for chunk in chunks[:max_chunks]:
            if use_lightweight_concepts:
                chunk_concepts = _cheap_concepts(chunk)
                for concept in chunk_concepts:
                    if concept not in concepts:
                        concepts.append(concept)
            else:
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
                            "generation_source": generation_source,
                        }
                    },
                )
            finally:
                client.close()

        loop.run_until_complete(_persist())
        if questions:
            _save_cached_questions(video_url, questions)

    except MaxRetriesExceededError as exc:
        # All retries exhausted — mark session failed so the extension stops polling
        async def _mark_exhausted() -> None:
            client = AsyncIOMotorClient(mongodb_url)
            try:
                db_name = mongodb_url.rsplit("/", 1)[-1] if "/" in mongodb_url else "learnpulse"
                db = client[db_name]
                await db.sessions.update_one(
                    {"session_id": session_id},
                    {"$set": {"status": "failed", "error": f"Task retries exhausted: {exc}"}},
                )
            finally:
                client.close()
        loop2 = asyncio.new_event_loop()
        try:
            loop2.run_until_complete(_mark_exhausted())
        finally:
            loop2.close()
    except Exception as exc:  # pragma: no cover - task retry path
        raise self.retry(exc=exc, countdown=10)
    finally:
        loop.close()
