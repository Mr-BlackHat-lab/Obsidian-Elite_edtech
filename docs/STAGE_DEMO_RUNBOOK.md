# LearnPulse AI - Stage Demo Runbook

Use this runbook for live demos and sanity checks.

## 1. Current demo goals

- prove the backend is healthy
- show the CLI can talk to the backend
- show the frontend can read auth and performance data
- show the extension can detect a video and ask questions
- show demo mode fallback for the target video

## 2. Start the stack

From repo root:

```bash
docker compose up --build -d
docker compose ps
```

Expected services:

- backend
- MongoDB
- Redis
- Celery worker

## 3. Backend smoke checks

```bash
curl http://localhost:8000/health
curl http://localhost:8000/docs
```

Expected health shape:

```json
{ "status": "ok", "service": "LearnPulse AI" }
```

Useful runtime checks:

- GET /performance/cli_user
- POST /submit-answer
- POST /transcribe

## 4. Seed demo data

For a stable presentation, keep a demo user and session available.

Recommended demo identity:

- user_id: cli_user
- session_id: demo-session

If the backend demo data needs to be refreshed, use the current backend setup or the CLI workflow to create it again.

## 5. CLI demo sequence

Install dependencies once:

```bash
python -m pip install -r cli/requirements.txt
```

Run from `cli/`:

```bash
python main.py process --url "https://www.youtube.com/watch?v=demo"
python main.py test --session-id demo-session
python main.py progress --user-id cli_user
```

Optional export:

```bash
python main.py test --session-id demo-session --export-path demo_results.json
```

## 6. Frontend demo sequence

1. Start the frontend dev server.
2. Open the app in the browser.
3. Log in or sign up with the backend-compatible fields.
4. Verify the dashboard and performance views load.

Frontend base URL:

```env
VITE_API_BASE_URL=http://localhost:8000
```

## 7. Extension demo sequence

1. Build the extension.
2. Load `extension/dist` in Chrome.
3. Open a YouTube watch page.
4. Turn on Demo Mode.
5. Refresh the tab if needed.

### Demo video fallback

The target demo video is:

- https://www.youtube.com/watch?v=ZzI9JE0i6Lc

In demo mode, that video should use the local 3-question fallback if backend fetch does not succeed.

### What to show

- video detection
- pause and question prompt
- answer flow
- fallback behavior when backend data is unavailable

## 8. Redis and cache checks

Useful checks:

```bash
docker exec learnpulse_redis redis-cli ping
docker exec learnpulse_redis redis-cli KEYS "vidcache:*"
docker exec learnpulse_redis redis-cli TTL "vidcache:https://www.youtube.com/watch?v=demo"
```

## 9. Presentation order

1. Show Docker stack status.
2. Show backend `/health`.
3. Run one CLI `process` flow.
4. Run CLI `test`.
5. Show frontend dashboard or performance page.
6. Load the extension on YouTube.
7. Demonstrate demo mode on `ZzI9JE0i6Lc`.

## 10. Common issues

### Extension does not respond

- Reload the unpacked extension.
- Refresh the YouTube page.
- Confirm the popup shows the correct tab state.

### Backend not being hit

- Check backend logs.
- Confirm the extension and frontend point to `http://localhost:8000`.

### Demo mode stays idle

- Make sure Demo Mode is enabled.
- Use the target video.
- Reload after rebuilding the extension.

## 11. Success checklist

- backend health passes
- CLI commands complete
- frontend loads
- extension injects on YouTube
- demo questions appear on the target video
