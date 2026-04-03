from __future__ import annotations

import os
from pathlib import Path

import requests
from rich.console import Console


DEFAULT_BACKEND_URL = "http://localhost:8000"
DEFAULT_REDIS_URL = "redis://localhost:6379/0"


def _load_dotenv_file(dotenv_path: Path) -> None:
    if not dotenv_path.exists():
        return

    for raw_line in dotenv_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def load_cli_environment() -> None:
    # Support running from repo root or from the cli/ directory.
    repo_root = Path(__file__).resolve().parent.parent
    _load_dotenv_file(repo_root / ".env")


load_cli_environment()


def get_backend_url() -> str:
    return os.getenv("CLI_BACKEND_URL") or os.getenv("BACKEND_URL") or DEFAULT_BACKEND_URL


def get_redis_url() -> str:
    return os.getenv("REDIS_URL", DEFAULT_REDIS_URL)


API_BASE = get_backend_url().rstrip("/")
REDIS_URL = get_redis_url()


def check_backend_health(console: Console, timeout: int = 5) -> bool:
    try:
        response = requests.get(f"{API_BASE}/health", timeout=timeout)
        if response.ok:
            return True
        console.print(
            f"[yellow]Backend health check failed:[/yellow] {API_BASE}/health returned {response.status_code}."
        )
        return False
    except requests.RequestException:
        console.print(
            f"[yellow]Backend not reachable at {API_BASE}.[/yellow] "
            "Set CLI_BACKEND_URL/BACKEND_URL if your API runs on a different host or port."
        )
        return False
