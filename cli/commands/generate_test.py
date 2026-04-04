from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import click
import requests
from rich.console import Console
from rich.panel import Panel
from config import API_BASE, check_backend_health

console = Console()
DEFAULT_RESULTS_DIR = Path(__file__).resolve().parent.parent / "results"
DEMO_QUESTIONS_PATH = Path(__file__).resolve().parent.parent / "demo_questions.json"


def _default_demo_questions() -> list[dict]:
    return [
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
    ]


def _load_demo_questions() -> list[dict]:
    if not DEMO_QUESTIONS_PATH.exists():
        return _default_demo_questions()

    try:
        content = json.loads(DEMO_QUESTIONS_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return _default_demo_questions()

    if not isinstance(content, list) or not content:
        return _default_demo_questions()

    return content


def _mock_session(session_id: str) -> dict:
    return {
        "session_id": session_id,
        "user_id": "anonymous",
        "questions": _load_demo_questions(),
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
    try:
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

    except requests.RequestException:
        expected = str(question.get("answer", "")).strip().upper()
        correct = expected == user_answer.strip().upper()
        console.print(
            "[yellow]submit-answer unavailable. Using local grading fallback for demo stability.[/yellow]"
        )
        return {
            "correct": correct,
            "explanation": question.get("explanation", "No explanation provided."),
            "updated_score": 0.0,
            "weak_topics": [],
        }


def _export_results(export_path: Path, payload: dict) -> None:
    export_path.parent.mkdir(parents=True, exist_ok=True)
    export_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


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
@click.option(
    "--export-path",
    required=False,
    type=click.Path(dir_okay=False, writable=True, path_type=Path),
    help="Optional output path for JSON results. Defaults to cli/results/{session_id}_results.json.",
)
def test_command(session_id: str, export_path: Path | None) -> None:
    """Run an interactive test for a session."""
    try:
        check_backend_health(console)
        session = _fetch_session(session_id)
        questions = session.get("questions", [])
        resolved_session_id = str(session.get("session_id", session_id))
        resolved_user_id = str(session.get("user_id", "unknown"))

        console.print(
            Panel(
                f"Session: {resolved_session_id}\nUser: {resolved_user_id}",
                title="Active Quiz Context",
                border_style="bright_blue",
            )
        )

        if not questions:
            console.print("[yellow]No questions available for this session.[/yellow]")
            return

        results: list[dict] = []
        correct_count = 0

        for idx, question in enumerate(questions, start=1):
            _render_question(question, idx, len(questions))
            answer = click.prompt(
                "Your answer",
                type=click.Choice(["A", "B", "C", "D"], case_sensitive=False),
            ).upper()

            feedback = _submit_answer(session_id, question, answer)
            is_correct = bool(feedback.get("correct"))
            if is_correct:
                console.print("[green]Correct![/green]")
                correct_count += 1
            else:
                console.print("[red]Incorrect.[/red]")

            console.print(f"[cyan]Explanation:[/cyan] {feedback.get('explanation', 'No explanation provided.')}")

            results.append(
                {
                    "question_id": question.get("question_id"),
                    "question": question.get("question"),
                    "difficulty": question.get("difficulty"),
                    "concept_tag": question.get("concept_tag"),
                    "user_answer": answer,
                    "correct": is_correct,
                    "explanation": feedback.get("explanation", "No explanation provided."),
                }
            )

            if idx < len(questions):
                click.pause("Press ENTER for next question")

        summary = {
            "session_id": resolved_session_id,
            "user_id": resolved_user_id,
            "submitted_at": datetime.now(timezone.utc).isoformat(),
            "total_questions": len(questions),
            "correct_answers": correct_count,
            "accuracy": round((correct_count / len(questions)) * 100, 2),
        }
        output_path = export_path or (DEFAULT_RESULTS_DIR / f"{resolved_session_id}_results.json")
        _export_results(output_path, {"summary": summary, "results": results})

        console.print(f"[bold cyan]Results exported:[/bold cyan] {output_path}")
        console.print("[bold green]Quiz complete.[/bold green]")

    except requests.exceptions.ConnectionError:
        console.print(
            f"[red]Could not connect to FastAPI at {API_BASE}.[/red] "
            "Start backend services and try again."
        )
    except requests.exceptions.Timeout:
        console.print(
            "[red]Request timed out while fetching quiz data.[/red] "
            "Retry in a few seconds or switch to demo session."
        )
    except requests.RequestException as exc:
        console.print(
            f"[red]Request failed:[/red] {exc}\n"
            "[yellow]Tip:[/yellow] Use a seeded demo session if backend generation is still in progress."
        )
