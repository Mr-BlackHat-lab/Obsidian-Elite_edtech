from __future__ import annotations

import asyncio
import os
import tempfile
import time

import redis.asyncio as redis

from services.transcription import MIN_AUDIO_BYTES, get_whisper_model

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
ROLLING_BUFFER_MAX = max(3, int(os.getenv("LIVE_BUFFER_MAX_CHUNKS", "12")))
CONCEPT_CHECK_INTERVAL = max(5, int(os.getenv("LIVE_CONCEPT_CHECK_INTERVAL", "60")))
KEY_TTL_SECONDS = max(300, int(os.getenv("LIVE_REDIS_TTL_SECONDS", "7200")))

_redis_client: redis.Redis | None = None

# Cached result of the one-time Whisper + ffmpeg availability check
_whisper_check: tuple[bool, str] | None = None


def check_whisper_available() -> tuple[bool, str]:
    """Return (ok, error_message). Result is cached after first call."""
    global _whisper_check
    if _whisper_check is not None:
        return _whisper_check

    try:
        import whisper  # noqa: F401
    except ImportError:
        _whisper_check = (False, "openai-whisper package is not installed")
        return _whisper_check

    try:
        import subprocess
        r = subprocess.run(["ffmpeg", "-version"], capture_output=True, timeout=3)
        if r.returncode != 0:
            _whisper_check = (False, "ffmpeg is not available on PATH")
            return _whisper_check
    except Exception:
        _whisper_check = (False, "ffmpeg is not available on PATH")
        return _whisper_check

    _whisper_check = (True, "")
    return _whisper_check


async def get_redis() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(REDIS_URL, decode_responses=True)
    return _redis_client


_WHISPER_NOISE_TOKENS = {
    "[music]", "[applause]", "[laughter]", "(music)",
    "[blank_audio]", "[silence]", "[ __ ]", "",
}


def _is_noise(text: str) -> bool:
    """Return True if Whisper returned a noise/hallucination token instead of speech."""
    t = text.strip().lower()
    if t in _WHISPER_NOISE_TOKENS:
        return True
    # Whisper hallucinates short filler phrases on silence
    if len(t) < 8 and t.startswith("[") and t.endswith("]"):
        return True
    return False


async def transcribe_chunk_live(audio_bytes: bytes) -> str:
    """
    Transcribe a raw audio chunk using the shared local Whisper model.
    Skips chunks below MIN_AUDIO_BYTES to avoid silent empty results.
    """
    if len(audio_bytes) < MIN_AUDIO_BYTES:
        return ""

    def _run() -> str:
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name
        try:
            model = get_whisper_model()
            result = model.transcribe(tmp_path, fp16=False)
            text = str(result.get("text", "")).strip()
            # Filter Whisper noise/hallucination tokens
            if _is_noise(text):
                return ""
            return text
        except Exception as exc:
            print(f"[Whisper] live transcription error: {exc}")
            return ""
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    return await asyncio.to_thread(_run)


async def load_buffer_from_redis(session_id: str) -> list[str]:
    client = await get_redis()
    key = f"live:buffer:{session_id}"
    items = await client.lrange(key, 0, -1)
    return [item for item in items if item]


async def save_chunk_to_buffer(session_id: str, chunk_text: str) -> None:
    text = chunk_text.strip()
    if not text:
        return
    client = await get_redis()
    key = f"live:buffer:{session_id}"
    await client.rpush(key, text)
    await client.ltrim(key, -ROLLING_BUFFER_MAX, -1)
    await client.expire(key, KEY_TTL_SECONDS)


async def get_full_buffer_text(session_id: str) -> str:
    chunks = await load_buffer_from_redis(session_id)
    return " ".join(chunks)


async def load_asked_concepts(session_id: str) -> set[str]:
    client = await get_redis()
    key = f"live:asked:{session_id}"
    concepts = await client.smembers(key)
    return {concept for concept in concepts if concept}


async def mark_concept_asked(session_id: str, concept: str) -> None:
    value = concept.strip()
    if not value:
        return
    client = await get_redis()
    key = f"live:asked:{session_id}"
    await client.sadd(key, value)
    await client.expire(key, KEY_TTL_SECONDS)


def should_trigger_quiz(last_quiz_time: float, interval: float = CONCEPT_CHECK_INTERVAL) -> bool:
    return time.time() - last_quiz_time >= interval
