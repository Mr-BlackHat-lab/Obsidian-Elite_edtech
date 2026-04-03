# OB: Video-to-Quiz Learning Engine

Turn passive video watching into active learning.

This project converts video content (YouTube or local files) into structured quizzes with difficulty levels, concept grouping, and performance tracking.

## Why This Stack

This version intentionally removes Svelte and keeps the system practical, scalable, and buildable:

- Python handles AI/NLP where it is strongest.
- Rust provides a fast, reliable backend API layer.
- React (or vanilla JS) powers the browser extension without heavy framework overhead.
- SQLite starts simple; PostgreSQL comes later.

## Updated Tech Stack

### Input and Extraction

- YouTube API (captions)
- FFmpeg (audio extraction)
- Whisper or faster-whisper (fallback when captions are missing, plus live support)

### AI and Processing Layer

- Python (core AI service)
- spaCy (keyword/entity extraction, NLP basics)
- sentence-transformers + FAISS (semantic grouping and retrieval)
- LLM provider:
  - Google Gemini API, or
  - Local models via Ollama (LLaMA, Mistral)

### Backend

- Rust (Axum or Actix Web)
- Responsibilities:
  - API endpoints
  - job orchestration
  - communication with Python AI service

### Interfaces

- CLI first (recommended MVP)
  - Python CLI (Typer), or
  - Node.js CLI (commander)
- Browser extension (later)
  - Manifest v3
  - React + Vite, or vanilla JS
  - Tailwind or plain CSS

### Storage

- SQLite (MVP)
- PostgreSQL (scaling phase)
- Redis (optional caching)

### Dev Environment

- Docker + Docker Compose for:
  - Rust backend
  - Python AI service
  - database

## High-Level Architecture

```text
[Browser/CLI]
				|
[React Extension / CLI]
				|
[Rust Backend]
				|
[Python AI Service]
				|
[LLM + NLP + FAISS]
				|
[Database]
```

## Build Stages

### Stage 1: CLI MVP (Foundation)

Goal: `Video -> Questions`

1. Accept input: YouTube URL or local file.
2. Extract transcript via captions or Whisper.
3. Clean and chunk transcript.
4. Send chunks to LLM.
5. Generate easy, medium, and hard questions.
6. Print results in CLI.

Deliverable: end-to-end quiz generation without UI.

### Stage 2: Concept Intelligence

Goal: improve relevance and structure.

1. Extract keywords and entities with spaCy.
2. Group transcript into concept/topic clusters.
3. Store embeddings in FAISS.
4. Link generated questions to concepts.

Deliverable: concept-aware question generation.

### Stage 3: Question Engine Upgrade

Goal: become a real learning engine.

1. Enforce difficulty logic:
   - Easy: recall
   - Medium: explain
   - Hard: apply
2. Support question types:
   - MCQ
   - short answer
   - true/false
3. Generate answers and explanations.

Deliverable: richer and pedagogically meaningful quizzes.

### Stage 4: Performance Tracking

Goal: track learning outcomes.

1. Store attempts in SQLite.
2. Track score trends and weak concepts.
3. Generate targeted feedback.

Deliverable: measurable progress and diagnostics.

### Stage 5: Browser Extension (React)

Goal: interrupt passive learning loops.

1. Detect supported video pages.
2. Inject overlay UI via content scripts.
3. Add controls: Start Quiz, Auto Mode.
4. Pause video periodically.
5. Show quiz modal and capture answers.

Deliverable: interactive in-video learning experience.

### Stage 6: Live Video Support

Goal: near real-time quiz generation.

1. Capture live audio stream.
2. Stream chunks to Whisper.
3. Process transcript windows (about 30s).
4. Generate short-form questions continuously.
5. Display real-time quiz overlays.

Deliverable: live-session learning prompts.

### Stage 7: Polish and Expansion

- Add caching strategy.
- Improve prompts and guardrails.
- Add spaced repetition.
- Export tests (PDF/JSON).
- Add user profiles.

## Project Structure (Planned)

```text
.
|-- rust-backend/
|-- python-ai-service/
|-- cli/
|-- extension/
|-- docs/
|   |-- CLI_BACKEND_FRONTEND_GUIDE.md
|   `-- STAGE_DEMO_RUNBOOK.md
|-- infra/
|   `-- docker-compose.yml
`-- README.md
```

## CLI Usage

For complete backend/frontend CLI integration and secret handling, see:

- `docs/CLI_BACKEND_FRONTEND_GUIDE.md`

For presentation-ready validation commands, see:

- `docs/STAGE_DEMO_RUNBOOK.md`

Install the CLI dependencies first:

```bash
cd cli
python -m pip install -r requirements.txt
```

Run the commands from inside the `cli/` folder:

```bash
python main.py process --url "https://www.youtube.com/watch?v=demo"
python main.py test --session-id demo-session
python main.py progress --user-id cli_user
```

Export quiz results to JSON:

```bash
python main.py test --session-id demo-session --export-path demo_results.json
```

Default export behavior:

- If `--export-path` is not provided, the CLI writes `{session_id}_results.json` in the current directory.

Redis video cache helper:

- If `/transcribe` is not ready (404), `process` will read/write `vidcache:{video_url}` in Redis (24h TTL).
- This keeps demo flows stable by reusing known session IDs.

### Demo Flow

1. Run `process` to create or load a session.
2. Run `test` to answer the generated questions and export a JSON report.
3. Run `progress` to see your topic breakdown and feedback.

## MVP Definition

MVP is complete when the CLI can:

- ingest a YouTube URL or local video,
- produce transcript text,
- generate multi-difficulty questions,
- output answers and explanations.

No browser UI required for MVP.

## Known Risks (Brutal Truth)

- React extension debugging can be slow and painful.
- Live transcription is error-prone under real-world audio conditions.
- LLM usage costs can climb quickly without guardrails and caching.

## Suggested Development Order

1. Build Stage 1 fully in Python CLI.
2. Split AI logic into a Python service API.
3. Add Rust backend orchestration.
4. Add storage and tracking.
5. Build extension once the engine is stable.

## License

TBD
