from __future__ import annotations

import click
import requests
from rich.console import Console

API_BASE = "http://localhost:8000"
console = Console()


@click.command("process")
@click.option("--url", required=True, type=str, help="YouTube URL or video URL to process.")
def process_command(url: str) -> None:
    """Process a video URL and create a quiz session."""
    endpoint = f"{API_BASE}/transcribe"
    payload = {"video_url": url}

    try:
        with console.status(
            "[bold cyan]Extracting transcript and generating AI questions...[/bold cyan]",
            spinner="dots",
        ):
            response = requests.post(endpoint, json=payload, timeout=120)

        if response.status_code == 404:
            data = {"session_id": "demo-session"}
            console.print(
                "[yellow]Backend endpoint not ready (404). Using seeded demo session.[/yellow]"
            )
        else:
            response.raise_for_status()
            data = response.json()

        session_id = data.get("session_id", "unknown-session")
        console.print(f"[green]Success:[/green] session created: [bold]{session_id}[/bold]")
        console.print(f"Run: [bold]python cli/main.py test --session-id {session_id}[/bold]")

    except requests.exceptions.ConnectionError:
        console.print(
            "[red]Could not connect to FastAPI at http://localhost:8000.[/red] "
            "Start backend services and try again."
        )
    except requests.RequestException as exc:
        console.print(f"[red]Request failed:[/red] {exc}")
