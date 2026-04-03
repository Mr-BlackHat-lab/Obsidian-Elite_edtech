# CLI Backend and Frontend Integration Guide

This guide explains how to use the LearnPulse CLI with backend APIs and frontend flows, including setup, demo mode, and secret handling.

## 1. What the CLI is used for

The CLI is used to:

- start a video processing flow (`process`)
- run interactive quiz attempts (`test`)
- inspect user performance (`progress`)
- export quiz attempt results to JSON for sharing or frontend preview

The frontend does not execute Python CLI commands directly in the browser. The frontend should call backend APIs (`/session`, `/submit-answer`, `/performance`) that the CLI also uses.

## 2. Prerequisites

- Docker and Docker Compose installed
- Python 3.11+
- Running services from repo root:

```bash
docker compose up --build -d
```

Verify backend:

```bash
curl http://localhost:8000/health
```

Expected:

```json
{ "status": "ok" }
```

## 3. Install CLI dependencies

From repo root:

```bash
python -m pip install -r cli/requirements.txt
```

## 4. CLI commands

Run these from `cli/`:

```bash
cd cli
python main.py process --url "https://www.youtube.com/watch?v=demo"
python main.py test --session-id demo-session
python main.py progress --user-id cli_user
```

### 4.1 Export test output to JSON

```bash
python main.py test --session-id demo-session --export-path demo_results.json
```

If `--export-path` is omitted, output is:

```text
{session_id}_results.json
```

Example:

```text
demo-session_results.json
```

## 5. Backend integration contract

CLI depends on these backend endpoints:

- `POST /transcribe`
- `GET /session/{session_id}`
- `POST /submit-answer`
- `GET /performance/{user_id}`

### 5.1 Important fallback behavior for demo stability

- If `POST /transcribe` returns 404, CLI process command falls back to Redis cache key `vidcache:{video_url}`.
- If no cache entry exists, CLI uses `demo-session` and writes it to Redis with 24-hour TTL.
- If `POST /submit-answer` is unavailable, CLI test command falls back to local grading so demos can continue.

## 6. Frontend usage pattern

Frontend should consume backend APIs, not call CLI directly.

Recommended flow in frontend:

1. Start/obtain session via backend (or existing session id).
2. Fetch questions from `GET /session/{session_id}`.
3. Send answers to `POST /submit-answer`.
4. Render progress from `GET /performance/{user_id}`.
5. Optionally read CLI-exported JSON (from local dev runs) for UI prototyping.

## 7. Demo mode setup (seeded data)

If backend AI/transcribe is not ready, seed a demo session and use:

```bash
python main.py process --url "https://www.youtube.com/watch?v=demo"
python main.py test --session-id demo-session
python main.py progress --user-id cli_user
```

This gives a stable demo flow even when upstream AI endpoints are under development.

## 8. Secrets and environment variables

Use `.env` locally and do not commit it.

- committed template: `.env.example`
- local secret file: `.env` (gitignored)

Required variables:

```env
GEMINI_API_KEY=
MONGODB_URL=mongodb://mongo:27017/learnpulse
REDIS_URL=redis://redis:6379/0
YOUTUBE_API_KEY=
WHISPER_MODEL=base
APP_ENV=development
DEBUG=true
BACKEND_URL=http://localhost:8000
```

CLI note:

- `BACKEND_URL` (or `CLI_BACKEND_URL`) controls where CLI commands send API requests.
- Default remains `http://localhost:8000` when not set.

Security rules:

- Never commit real API keys.
- Never paste real keys into screenshots or demo slides.
- Rotate keys if they were exposed.

## 9. Troubleshooting

### Backend not reachable

- symptom: connection error in CLI
- fix:

```bash
docker compose ps
docker compose up --build -d
```

### Session not found

- symptom: `Session not found`
- fix: run process first or use seeded `demo-session`

### Empty performance

- symptom: no session history in progress
- fix: run test and submit at least one answer

### Redis cache check

```bash
docker exec learnpulse_redis redis-cli KEYS "vidcache:*"
docker exec learnpulse_redis redis-cli TTL "vidcache:https://www.youtube.com/watch?v=demo"
```

## 10. Quick checklist before handoff

- Docker services healthy
- CLI commands run without crash
- JSON export created successfully
- Frontend team has backend endpoint contract
- `.env` kept local and secret
