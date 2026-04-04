# CLI, Backend, and Frontend Integration Guide

This guide explains how the Python CLI, FastAPI backend, and React frontend fit together in the current project.

## 1. System roles

- Backend: provides transcript processing, question generation, scoring, session data, auth, and performance APIs.
- CLI: runs batch and demo workflows against the backend.
- Frontend: uses the backend directly for auth, dashboard, and progress views.

The frontend does not call the CLI. The CLI and frontend both rely on the same backend API contract.

## 2. Local prerequisites

- Docker and Docker Compose
- Python 3.11+
- Node.js for the frontend and extension build steps

Start the backend stack from the repo root:

```bash
docker compose up --build -d
```

Health check:

```bash
curl http://localhost:8000/health
```

Expected shape:

```json
{ "status": "ok", "service": "LearnPulse AI" }
```

## 3. CLI install and usage

Install CLI dependencies:

```bash
python -m pip install -r cli/requirements.txt
```

Run commands from `cli/`:

```bash
python main.py process --url "https://www.youtube.com/watch?v=demo"
python main.py test --session-id demo-session
python main.py progress --user-id cli_user
```

### 3.1 Export results

```bash
python main.py test --session-id demo-session --export-path demo_results.json
```

If no export path is provided, the CLI writes a default results file in its output folder.

## 4. Backend contract used by CLI and frontend

Main endpoints:

- POST /transcribe
- GET /session/{session_id}
- POST /generate-questions
- POST /submit-answer
- GET /performance/{user_id}
- POST /auth/register
- POST /auth/login
- GET /users/me
- WebSocket /ws/live

## 5. CLI behavior notes

- `process` sends a video URL to the backend and receives or seeds a session.
- `test` loads questions and submits answers to the backend.
- `progress` reads the user performance endpoint.

Demo fallback behavior:

- If the backend transcript step is unavailable, the CLI can still continue with local/demo data.
- Demo data is kept in `cli/demo_questions.json`.
- Keep the demo bank small and stable so presentations remain predictable.

## 6. Frontend usage pattern

The frontend should:

1. Register or log in through the backend.
2. Read the current user from the backend.
3. Show performance data from GET /performance/{user_id}.
4. Use the same backend session and answer flow as the CLI.

Configured API base URL:

```env
VITE_API_BASE_URL=http://localhost:8000
```

## 7. Environment variables

Keep local secrets in `.env` and never commit them.

Suggested local values:

```env
BACKEND_URL=http://localhost:8000
CLI_BACKEND_URL=http://localhost:8000
VITE_API_BASE_URL=http://localhost:8000
API_BASE_URL=http://localhost:8000
MONGODB_URL=mongodb://mongo:27017/learnpulse
REDIS_URL=redis://redis:6379/0
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173
```

## 8. Extension and frontend connection notes

- The extension uses the backend for question generation and answer submission.
- The frontend uses the same backend routes for auth and performance.
- If the extension is in demo mode, it can fall back to local questions for the special demo video.

Demo video used for fallback:

- https://www.youtube.com/watch?v=ZzI9JE0i6Lc

## 9. Troubleshooting

### Backend not reachable

- Confirm Docker containers are running.
- Re-run `docker compose up --build -d`.

### CLI cannot connect

- Check `BACKEND_URL` or `CLI_BACKEND_URL`.
- Confirm `/health` returns ok.

### Frontend shows auth or API errors

- Confirm `VITE_API_BASE_URL` points to `http://localhost:8000`.
- Make sure the backend CORS list includes the frontend origin.

### Demo mode does not ask questions

- Reload the extension.
- Refresh the YouTube tab.
- Use the demo video `ZzI9JE0i6Lc`.

## 10. Handoff checklist

- Backend health check passes
- CLI process/test/progress commands run successfully
- Frontend can log in and load performance data
- Extension loads from `extension/dist`
- Demo fallback works for the target video
