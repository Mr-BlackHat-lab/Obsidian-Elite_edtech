from __future__ import annotations

import asyncio
import os
import shutil
import tempfile
from functools import lru_cache
from urllib.parse import parse_qs, urlparse

try:
    from youtube_transcript_api import YouTubeTranscriptApi
    from youtube_transcript_api._errors import (
        NoTranscriptFound,
        TranscriptsDisabled,
        VideoUnavailable,
    )
except ImportError:
    YouTubeTranscriptApi = None
    NoTranscriptFound = Exception
    TranscriptsDisabled = Exception
    VideoUnavailable = Exception

CAPTION_CACHE_SIZE = max(1, int(os.getenv("YOUTUBE_CAPTION_CACHE_SIZE", "128")))
WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL", "base")
MIN_AUDIO_BYTES = 4096  # shared by live_stream.py — chunks below this are skipped

# Single shared Whisper model — imported by live_stream.py too
_whisper_model = None


def get_whisper_model():
    """Lazy-load and cache the Whisper model (shared across the process)."""
    global _whisper_model
    if _whisper_model is None:
        import whisper
        _whisper_model = whisper.load_model(WHISPER_MODEL_SIZE)
    return _whisper_model


def extract_youtube_video_id(url: str) -> str | None:
    parsed = urlparse(url)
    host = parsed.netloc.lower()
    if "youtube.com" in host:
        return parse_qs(parsed.query).get("v", [None])[0]
    if "youtu.be" in host:
        return parsed.path.lstrip("/") or None
    return None


def _fetch_transcript_rows(video_id: str) -> list[dict]:
    """
    Fetch transcript rows handling both youtube-transcript-api v0.x and v1.x.

    v0.x: YouTubeTranscriptApi.get_transcript(video_id)  — class method, returns list[dict]
    v1.x: YouTubeTranscriptApi.fetch(video_id)           — class method, returns FetchedTranscript
          or list_transcripts + find_transcript + fetch
    """
    api = YouTubeTranscriptApi()

    # --- v1.x instance path: fetch(video_id) ---
    if hasattr(api, "fetch"):
        # Try direct fetch (uses default language preference)
        try:
            fetched = api.fetch(video_id)
            return [{"text": getattr(s, "text", "")} for s in fetched]
        except (NoTranscriptFound, TranscriptsDisabled):
            pass
        except Exception:
            pass

        # Try listing all transcripts and picking best one
        list_method = getattr(api, "list", None) or getattr(api, "list_transcripts", None)
        if list_method:
            try:
                transcript_list = list_method(video_id)
                try:
                    t = transcript_list.find_manually_created_transcript(["en", "en-US", "en-GB"])
                except Exception:
                    try:
                        t = transcript_list.find_generated_transcript(["en", "en-US", "en-GB"])
                    except Exception:
                        t = next(iter(transcript_list))
                fetched = t.fetch()
                return [{"text": getattr(s, "text", "")} for s in fetched]
            except Exception:
                pass

        # Last resort: try with explicit language list
        try:
            fetched = api.fetch(video_id, languages=["en", "en-US", "en-GB", "en-IN"])
            return [{"text": getattr(s, "text", "")} for s in fetched]
        except Exception as exc:
            raise ValueError(f"No transcript available for {video_id}: {exc}") from exc

    # --- v0.x class method path ---
    try:
        return YouTubeTranscriptApi.get_transcript(video_id)
    except Exception:
        pass
    try:
        return YouTubeTranscriptApi.get_transcript(video_id, languages=["en", "en-US", "en-GB"])
    except Exception as exc:
        raise ValueError(f"No transcript available for {video_id}: {exc}") from exc


@lru_cache(maxsize=CAPTION_CACHE_SIZE)
def _get_youtube_captions_cached(video_id: str) -> str:
    if YouTubeTranscriptApi is None:
        raise ValueError("youtube-transcript-api package is not installed")

    rows = _fetch_transcript_rows(video_id)
    text = " ".join(item.get("text", "").strip() for item in rows).strip()
    if not text:
        raise ValueError(f"Captions were empty for video {video_id}")
    return text


def get_youtube_captions(video_id: str) -> str:
    return _get_youtube_captions_cached(video_id)


async def transcribe_audio_file(file_path: str) -> str:
    """Transcribe an audio file using the shared local Whisper model."""
    def _run() -> str:
        try:
            model = get_whisper_model()
            result = model.transcribe(file_path, fp16=False)
            return str(result.get("text", "")).strip()
        except Exception as exc:
            print(f"[Whisper] transcription error: {exc}")
            return ""

    return await asyncio.to_thread(_run)


async def transcribe_chunk_async(audio_bytes: bytes) -> str:
    """Transcribe raw audio bytes using local Whisper."""
    if len(audio_bytes) < MIN_AUDIO_BYTES:
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


async def _transcribe_youtube_via_whisper(video_url: str) -> str:
    """Download YouTube audio with yt-dlp and transcribe it with local Whisper."""

    def _download_audio() -> tuple[str, str]:
        import yt_dlp

        temp_dir = tempfile.mkdtemp(prefix="lp_ytdlp_")
        outtmpl = os.path.join(temp_dir, "%(id)s.%(ext)s")
        ydl_opts = {
            "format": "bestaudio/best",
            "outtmpl": outtmpl,
            "noplaylist": True,
            "quiet": True,
            "no_warnings": True,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=True)
            file_path = ydl.prepare_filename(info)
        return file_path, temp_dir

    file_path = ""
    temp_dir = ""
    try:
        file_path, temp_dir = await asyncio.to_thread(_download_audio)
        transcript = await transcribe_audio_file(file_path)
        return transcript.strip()
    finally:
        if temp_dir:
            shutil.rmtree(temp_dir, ignore_errors=True)


def chunk_transcript(transcript: str, chunk_size: int = 500) -> list[str]:
    words = transcript.split()
    return [" ".join(words[i: i + chunk_size]) for i in range(0, len(words), chunk_size)]


async def get_transcript(video_url: str) -> str:
    """Return transcript for a video URL — YouTube Transcript API only."""
    video_id = extract_youtube_video_id(video_url)
    if video_id:
        try:
            return get_youtube_captions(video_id)
        except ValueError as caption_exc:
            # Optional fallback: download audio and run Whisper when captions are blocked.
            fallback_enabled = os.getenv("WHISPER_YTDLP_FALLBACK", "true").lower() in {
                "1",
                "true",
                "yes",
                "on",
            }
            if fallback_enabled:
                try:
                    transcript = await _transcribe_youtube_via_whisper(video_url)
                    if transcript:
                        return transcript
                except Exception:
                    pass
            raise caption_exc
    raise ValueError(
        "Could not extract transcript. Provide a YouTube URL with captions enabled."
    )
