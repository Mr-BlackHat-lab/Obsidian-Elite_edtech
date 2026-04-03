from __future__ import annotations

import os
import tempfile
from urllib.parse import parse_qs, urlparse

from youtube_transcript_api import YouTubeTranscriptApi


def extract_youtube_video_id(url: str) -> str | None:
    """Extract a YouTube video id from common URL formats."""
    parsed = urlparse(url)
    host = parsed.netloc.lower()
    if "youtube.com" in host:
        return parse_qs(parsed.query).get("v", [None])[0]
    if "youtu.be" in host:
        return parsed.path.lstrip("/") or None
    return None


def get_youtube_captions(video_id: str) -> str:
    """Fetch YouTube captions and flatten them to plain text."""
    try:
        transcript = YouTubeTranscriptApi.get_transcript(video_id)
        text = " ".join(item.get("text", "").strip() for item in transcript).strip()
        if not text:
            raise ValueError("Captions were empty")
        return text
    except Exception as exc:  # pragma: no cover - network/provider dependent
        raise ValueError(f"Could not fetch captions for {video_id}: {exc}") from exc


async def transcribe_audio_file(file_path: str) -> str:
    """Placeholder for file transcription in Gemini-only mode."""
    if file_path:
        raise ValueError(
            "Direct file transcription is disabled in Gemini-only mode. "
            "Use YouTube caption path or provide transcript chunks from the client."
        )
    return ""


async def transcribe_chunk_async(audio_bytes: bytes) -> str:
    """Transcribe raw audio chunks in Gemini-only mode (currently disabled)."""
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
