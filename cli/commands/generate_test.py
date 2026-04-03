from __future__ import annotations

import click
import requests
from rich.console import Console
from rich.panel import Panel

API_BASE = "http://localhost:8000"
console = Console()


def _mock_session(session_id: str) -> dict:
    return {
        "session_id": session_id,
        "questions": [
            {
                "question_id": "q1",
                "question": "What is a Docker volume?",
                "difficulty": "medium",
                "concept_tag": "Docker",
                "type": "mcq",
                "options": [
                    "A way to make containers faster",
                    "A persistent data store outside the container lifecycle",
                    "A networking protocol",
                    "A container image format",
                ],
                "answer": "B",
                "explanation": "Volumes persist data outside the container lifecycle.",
            },
            {
                "question_id": "q2",
                "question": "What does Kubernetes orchestrate?",
                "difficulty": "easy",
                "concept_tag": "Kubernetes",
                "type": "mcq",
                "options": [
                    "Containers and services",
                    "Spreadsheets",
                    "Audio files",
                    "Kernel modules",
                ],
                "answer": "A",
                "explanation": "Kubernetes orchestrates containerized workloads and services.",
            },
        ],
    }


def _fetch_session(session_id: str) -> dict:
    response = requests.get(f"{API_BASE}/session/{session_id}", timeout=60)
    if response.status_code == 404:
        console.print(
            "[yellow]Session endpoint returned 404. Using mock quiz data for preview.[/yellow]"
        )
        return _mock_session(session_id)

    response.raise_for_status()
    return response.json()


def _submit_answer(session_id: str, question: dict, user_answer: str) -> dict:
    payload = {
        "session_id": session_id,
        "question_id": question.get("question_id"),
        "user_answer": user_answer,
        "concept_tag": question.get("concept_tag", "General"),
    }
    response = requests.post(f"{API_BASE}/submit-answer", json=payload, timeout=60)

    if response.status_code == 404:
        expected = str(question.get("answer", "")).strip().upper()
        correct = expected == user_answer.strip().upper()
        return {
            "correct": correct,
            "explanation": question.get("explanation", "No explanation provided."),
            "updated_score": 0.0,
            "weak_topics": [],
        }

    response.raise_for_status()
    return response.json()


def _render_question(question: dict, index: int, total: int) -> None:
    header = f"Question {index}/{total}  [{str(question.get('difficulty', 'unknown')).upper()}]  Topic: {question.get('concept_tag', 'General')}"
    body_lines = [question.get("question", "")]
    options = question.get("options", [])
    labels = ["A", "B", "C", "D"]
    for pos, option in enumerate(options[:4]):
        body_lines.append(f"  {labels[pos]}) {option}")

    console.print(Panel("\n".join(body_lines), title=header, border_style="cyan"))


@click.command("test")
@click.option("--session-id", required=True, type=str, help="Session ID to run quiz for.")
def test_command(session_id: str) -> None:
    """Run an interactive test for a session."""
    try:
        session = _fetch_session(session_id)
        questions = session.get("questions", [])
        if not questions:
            console.print("[yellow]No questions available for this session.[/yellow]")
            return

        for idx, question in enumerate(questions, start=1):
            _render_question(question, idx, len(questions))
            answer = click.prompt(
                "Your answer",
                type=click.Choice(["A", "B", "C", "D"], case_sensitive=False),
            ).upper()

            feedback = _submit_answer(session_id, question, answer)
            if feedback.get("correct"):
                console.print("[green]Correct![/green]")
            else:
                console.print("[red]Incorrect.[/red]")

            console.print(f"[cyan]Explanation:[/cyan] {feedback.get('explanation', 'No explanation provided.')}")
            if idx < len(questions):
                click.pause("Press ENTER for next question")

        console.print("[bold green]Quiz complete.[/bold green]")

    except requests.exceptions.ConnectionError:
        console.print(
            "[red]Could not connect to FastAPI at http://localhost:8000.[/red] "
            "Start backend services and try again."
        )
    except requests.RequestException as exc:
        console.print(f"[red]Request failed:[/red] {exc}")
