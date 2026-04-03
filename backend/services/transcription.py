from __future__ import annotations

import os
import tempfile
from functools import lru_cache
from urllib.parse import parse_qs, urlparse

try:
    from youtube_transcript_api import YouTubeTranscriptApi
except ImportError:  # pragma: no cover - depends on environment packages
    YouTubeTranscriptApi = None


CAPTION_CACHE_SIZE = max(1, int(os.getenv("YOUTUBE_CAPTION_CACHE_SIZE", "128")))
WHISPER_ENABLED = os.getenv("WHISPER_ENABLED", "false").lower() in {"1", "true", "yes", "on"}
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "whisper-1")


def extract_youtube_video_id(url: str) -> str | None:
    """Extract a YouTube video id from common URL formats."""
    parsed = urlparse(url)
    host = parsed.netloc.lower()
    if "youtube.com" in host:
        return parse_qs(parsed.query).get("v", [None])[0]
    if "youtu.be" in host:
        return parsed.path.lstrip("/") or None
    return None


@lru_cache(maxsize=CAPTION_CACHE_SIZE)
def _get_youtube_captions_cached(video_id: str) -> str:
    """Fetch and cache YouTube captions text to reduce repeated lookup latency."""
    try:
        if YouTubeTranscriptApi is None:
            raise ValueError("youtube-transcript-api package is not installed")

        transcript_rows = []

        # Newer versions expose instance fetch(); older versions use get_transcript().
        if hasattr(YouTubeTranscriptApi, "fetch"):
            fetched = YouTubeTranscriptApi().fetch(video_id)
            transcript_rows = [{"text": getattr(item, "text", "")} for item in fetched]
        else:
            transcript_rows = YouTubeTranscriptApi.get_transcript(video_id)

        text = " ".join(item.get("text", "").strip() for item in transcript_rows).strip()
        if not text:
            raise ValueError("Captions were empty")
        return text
    except Exception as exc:  # pragma: no cover - network/provider dependent
        raise ValueError(f"Could not fetch captions for {video_id}: {exc}") from exc


def get_youtube_captions(video_id: str) -> str:
    """Fetch YouTube captions and flatten them to plain text."""
    return _get_youtube_captions_cached(video_id)


async def transcribe_audio_file(file_path: str) -> str:
    """Best-effort audio transcription for live pipeline use.

    - Returns empty string when whisper is disabled (default free-tier path).
    - If enabled, tries OpenAI Whisper when OPENAI_API_KEY is available.
    """
    if not WHISPER_ENABLED:
        return ""

    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        return ""

    try:
        import openai

        client = openai.AsyncOpenAI(api_key=api_key)
        with open(file_path, "rb") as audio_file:
            response = await client.audio.transcriptions.create(
                model=WHISPER_MODEL,
                file=audio_file,
                response_format="text",
            )
        return str(response or "")
    except Exception:
        return ""


async def transcribe_chunk_async(audio_bytes: bytes) -> str:
    """Transcribe raw audio chunks for WebSocket live pipeline.

    Designed for T2 imports/calls: never raises hard failures, returns best-effort text.
    """
    if not audio_bytes:
        return ""

    if not WHISPER_ENABLED:
        return ""

    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        return await transcribe_audio_file(tmp_path)
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def chunk_transcript(transcript: str, chunk_size: int = 500) -> list[str]:
    """Split transcript into approximately `chunk_size` word chunks."""
    words = transcript.split()
    return [" ".join(words[i : i + chunk_size]) for i in range(0, len(words), chunk_size)]


async def get_transcript(video_url: str) -> str:
    """Return transcript text for a video URL (YouTube captions first)."""
    video_id = extract_youtube_video_id(video_url)
    if video_id:
        return get_youtube_captions(video_id)

    raise ValueError(
        "Could not extract transcript. Provide a YouTube URL with captions enabled."
    )
