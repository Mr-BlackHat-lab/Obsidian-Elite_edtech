from __future__ import annotations

import requests
import click
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

API_BASE = "http://localhost:8000"
console = Console()


def _mock_progress(user_id: str) -> dict:
    return {
        "user_id": user_id,
        "overall_accuracy": 0.74,
        "sessions_completed": 7,
        "total_questions": 89,
        "topic_breakdown": [
            {"topic": "Kubernetes basics", "accuracy": 0.92},
            {"topic": "Docker fundamentals", "accuracy": 0.86},
            {"topic": "Kubernetes Networking", "accuracy": 0.51},
            {"topic": "Docker Compose", "accuracy": 0.38},
        ],
        "recommendation": 'Revise "Docker Compose" and "Kubernetes Networking" before your next session.',
    }


def _fetch_progress(user_id: str) -> dict:
    response = requests.get(f"{API_BASE}/performance/{user_id}", timeout=60)
    if response.status_code == 404:
        console.print(
            "[yellow]Performance endpoint returned 404. Using mock dashboard data for preview.[/yellow]"
        )
        return _mock_progress(user_id)

    response.raise_for_status()
    return response.json()


@click.command("progress")
@click.option("--user-id", required=True, type=str, help="User ID to show progress for.")
def progress_command(user_id: str) -> None:
    """Show a progress dashboard with performance metrics."""
    try:
        data = _fetch_progress(user_id)
        accuracy_pct = int(float(data.get("overall_accuracy", 0.0)) * 100)
        sessions_completed = data.get("total_sessions", data.get("sessions_completed", 0))
        topic_breakdown = data.get("topic_breakdown", [])

        if isinstance(topic_breakdown, dict):
            topic_rows = [
                {"topic": topic, "accuracy": values.get("accuracy", 0.0)}
                for topic, values in topic_breakdown.items()
            ]
        else:
            topic_rows = list(topic_breakdown)

        top_panel = Panel(
            f"Overall Accuracy:   {accuracy_pct}%\n"
            f"Sessions Completed: {sessions_completed}\n"
            f"Total Questions:    {data.get('total_questions', 0)}",
            title="LearnPulse — Performance Report",
            border_style="bright_blue",
        )
        console.print(top_panel)

        table = Table(title="Topic Breakdown", header_style="bold magenta")
        table.add_column("Status", justify="center")
        table.add_column("Topic", style="bold")
        table.add_column("Accuracy", justify="right")

        for row in topic_rows:
            pct = int(float(row.get("accuracy", 0.0)) * 100)
            status = "✅" if pct >= 80 else "⚠️" if pct >= 60 else "❌"
            table.add_row(status, str(row.get("topic", "General")), f"{pct}%")

        console.print(table)
        recommendation = data.get("recommendation", data.get("feedback", "No recommendation available."))
        console.print(Panel(recommendation, title="AI Recommendation", border_style="green"))

    except requests.exceptions.ConnectionError:
        console.print(
            "[red]Could not connect to FastAPI at http://localhost:8000.[/red] "
            "Start backend services and try again."
        )
    except requests.RequestException as exc:
        console.print(f"[red]Request failed:[/red] {exc}")
