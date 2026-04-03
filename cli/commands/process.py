from __future__ import annotations

import click
import requests
from redis import Redis
from redis.exceptions import RedisError
from rich.console import Console
from config import API_BASE, REDIS_URL, check_backend_health

VIDEO_CACHE_TTL = 86400
console = Console()


def _cache_key(video_url: str) -> str:
    return f"vidcache:{video_url}"


def _get_cached_session(video_url: str) -> str | None:
    try:
        client = Redis.from_url(REDIS_URL, decode_responses=True)
        value = client.get(_cache_key(video_url))
        client.close()
        return value
    except RedisError:
        return None


def _set_cached_session(video_url: str, session_id: str) -> None:
    try:
        client = Redis.from_url(REDIS_URL, decode_responses=True)
        client.set(_cache_key(video_url), session_id, ex=VIDEO_CACHE_TTL)
        client.close()
    except RedisError:
        return


@click.command("process")
@click.option("--url", required=True, type=str, help="YouTube URL or video URL to process.")
@click.option(
    "--user-id",
    required=False,
    default="anonymous",
    show_default=True,
    type=str,
    help="User ID (username) to associate with the created/reused session.",
)
def process_command(url: str, user_id: str) -> None:
    """Process a video URL and create a quiz session."""
    check_backend_health(console)

    endpoint = f"{API_BASE}/transcribe"
    payload = {"video_url": url, "user_id": user_id}

    try:
        with console.status(
            "[bold cyan]Extracting transcript and generating AI questions...[/bold cyan]",
            spinner="dots",
        ):
            response = requests.post(endpoint, json=payload, timeout=120)

        if response.status_code == 404:
            cached_session = _get_cached_session(url)
            if cached_session:
                data = {"session_id": cached_session}
                console.print(
                    "[yellow]Transcribe endpoint not ready (404). Loaded cached session from Redis.[/yellow]"
                )
            else:
                data = {"session_id": "demo-session"}
                _set_cached_session(url, data["session_id"])
                console.print(
                    "[yellow]Transcribe endpoint not ready (404). Using demo session and caching vidcache:{video_url} for 24h.[/yellow]"
                )
        else:
            response.raise_for_status()
            data = response.json()
            if data.get("session_id"):
                _set_cached_session(url, str(data["session_id"]))

        session_id = data.get("session_id", "unknown-session")
        console.print(f"[green]Success:[/green] session created: [bold]{session_id}[/bold]")
        console.print(f"User: [bold]{user_id}[/bold]")
        console.print(f"Run: [bold]python cli/main.py test --session-id {session_id}[/bold]")
        console.print(f"Run: [bold]python cli/main.py progress --user-id {user_id}[/bold]")

    except requests.exceptions.ConnectionError:
        console.print(
            f"[red]Could not connect to FastAPI at {API_BASE}.[/red] "
            "Start backend services and try again."
        )
    except requests.exceptions.Timeout:
        console.print(
            "[red]Request timed out while processing video.[/red] "
            "Retry shortly, or use a shorter/known URL for demo mode."
        )
    except requests.RequestException as exc:
        console.print(
            f"[red]Request failed:[/red] {exc}\n"
            "[yellow]Tip:[/yellow] If backend AI endpoints are in progress, seed a demo session and run test/progress commands directly."
        )
