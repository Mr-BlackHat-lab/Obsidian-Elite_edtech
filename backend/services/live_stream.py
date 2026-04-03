from __future__ import annotations

import asyncio
import importlib
import os
import tempfile
import time
from types import ModuleType

import redis.asyncio as redis

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
ROLLING_BUFFER_MAX = max(3, int(os.getenv("LIVE_BUFFER_MAX_CHUNKS", "12")))
CONCEPT_CHECK_INTERVAL = max(5, int(os.getenv("LIVE_CONCEPT_CHECK_INTERVAL", "60")))
KEY_TTL_SECONDS = max(300, int(os.getenv("LIVE_REDIS_TTL_SECONDS", "7200")))
GEMINI_TRANSCRIBE_ENABLED = os.getenv("GEMINI_TRANSCRIBE_ENABLED", "true").lower() in {
    "1",
    "true",
    "yes",
    "on",
}
GEMINI_TRANSCRIBE_MODEL = os.getenv(
    "GEMINI_TRANSCRIBE_MODEL",
    os.getenv("GEMINI_MODEL", "gemini-2.0-flash"),
)
GEMINI_TRANSCRIBE_DEBUG = os.getenv("GEMINI_TRANSCRIBE_DEBUG", "false").lower() in {
    "1",
    "true",
    "yes",
    "on",
}

_redis_client: redis.Redis | None = None
_gemini_client = None
_gemini_module: ModuleType | None = None


async def get_redis() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(REDIS_URL, decode_responses=True)
    return _redis_client


def _get_gemini_client():
    """Lazily initialize Gemini client for live audio transcription fallback."""
    global _gemini_client

    if not GEMINI_TRANSCRIBE_ENABLED:
        return None
    global _gemini_module
    if _gemini_module is None:
        try:
            _gemini_module = importlib.import_module("google.genai")
        except Exception:
            return None

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return None

    if _gemini_client is None:
        _gemini_client = _gemini_module.Client(api_key=api_key)

    return _gemini_client


def _extract_gemini_text(response) -> str:
    """Best-effort extraction of text from Gemini responses across SDK variants."""
    text = str(getattr(response, "text", "") or "").strip()
    if text:
        return text

    try:
        candidates = getattr(response, "candidates", None) or []
        for candidate in candidates:
            content = getattr(candidate, "content", None)
            parts = getattr(content, "parts", None) or []
            chunks: list[str] = []
            for part in parts:
                part_text = str(getattr(part, "text", "") or "").strip()
                if part_text:
                    chunks.append(part_text)
            if chunks:
                return "\n".join(chunks).strip()
    except Exception:
        pass

    return ""


async def transcribe_chunk_with_gemini(audio_bytes: bytes) -> str:
    """Transcribe a raw audio chunk with Gemini when Whisper/OpenAI is unavailable."""
    if not audio_bytes:
        return ""

    client = _get_gemini_client()
    if client is None:
        return ""

    prompt = (
        "Transcribe this audio chunk to plain English text. "
        "Return only the transcript, no JSON and no extra commentary."
    )

    def _call() -> str:
        try:
            parts = [
                _gemini_module.types.Part.from_text(text=prompt),
                _gemini_module.types.Part.from_bytes(data=audio_bytes, mime_type="audio/webm"),
            ]

            response = client.models.generate_content(
                model=GEMINI_TRANSCRIBE_MODEL,
                contents=parts,
                config=_gemini_module.types.GenerateContentConfig(
                    temperature=0.0,
                    max_output_tokens=300,
                    response_mime_type="text/plain",
                ),
            )
            direct_text = _extract_gemini_text(response)
            if direct_text:
                return direct_text

            # Fallback path: upload the chunk as a temporary file and reference it.
            with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
                tmp.write(audio_bytes)
                tmp_path = tmp.name

            try:
                uploaded = client.files.upload(file=tmp_path)
                uploaded_response = client.models.generate_content(
                    model=GEMINI_TRANSCRIBE_MODEL,
                    contents=[prompt, uploaded],
                    config=_gemini_module.types.GenerateContentConfig(
                        temperature=0.0,
                        max_output_tokens=300,
                        response_mime_type="text/plain",
                    ),
                )
                return _extract_gemini_text(uploaded_response)
            finally:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass
        except Exception as exc:
            if GEMINI_TRANSCRIBE_DEBUG:
                print(f"[LIVE] Gemini transcription error: {exc}")
            return ""

    return await asyncio.to_thread(_call)


async def load_buffer_from_redis(session_id: str) -> list[str]:
    """Load rolling transcript chunks from Redis for reconnect recovery."""
    client = await get_redis()
    key = f"live:buffer:{session_id}"
    items = await client.lrange(key, 0, -1)
    return [item for item in items if item]


async def save_chunk_to_buffer(session_id: str, chunk_text: str) -> None:
    """Append chunk text and trim to configured rolling window."""
    text = chunk_text.strip()
    if not text:
        return

    client = await get_redis()
    key = f"live:buffer:{session_id}"
    await client.rpush(key, text)
    await client.ltrim(key, -ROLLING_BUFFER_MAX, -1)
    await client.expire(key, KEY_TTL_SECONDS)


async def get_full_buffer_text(session_id: str) -> str:
    """Return all buffered text as a single joined transcript."""
    chunks = await load_buffer_from_redis(session_id)
    return " ".join(chunks)


async def load_asked_concepts(session_id: str) -> set[str]:
    """Load concepts already asked for this session."""
    client = await get_redis()
    key = f"live:asked:{session_id}"
    concepts = await client.smembers(key)
    return {concept for concept in concepts if concept}


async def mark_concept_asked(session_id: str, concept: str) -> None:
    """Persist asked concept and refresh TTL."""
    value = concept.strip()
    if not value:
        return

    client = await get_redis()
    key = f"live:asked:{session_id}"
    await client.sadd(key, value)
    await client.expire(key, KEY_TTL_SECONDS)


def should_trigger_quiz(last_quiz_time: float, interval: float = CONCEPT_CHECK_INTERVAL) -> bool:
    """Return True when the concept-check interval elapsed."""
    return time.time() - last_quiz_time >= interval
