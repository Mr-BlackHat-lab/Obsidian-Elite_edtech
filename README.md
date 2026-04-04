# LearnPulse AI - EdTech Chrome Extension

Active recall learning system that generates quiz questions while watching educational videos.

## Features

- ✅ FREE unlimited question generation (Hugging Face API)
- ✅ Context-aware questions from video content
- ✅ Unique questions per session (no duplicates)
- ✅ Clickable concept tags (Google search)
- ✅ Auto pause/resume video
- ✅ Progress tracking (accuracy, streak, weak topics)
- ✅ Demo mode (30s intervals) and Normal mode (5min intervals)

## Quick Start

### 1. Start Backend

```bash
cd backend
python -m uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

Verify: http://localhost:8000/health

### 2. Load Extension

1. Open Chrome: `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select: `extension/dist` folder

<<<<<<< HEAD
### 3. Test

1. Open: https://www.youtube.com/watch?v=_uQrJ0TkZlc
2. Click extension icon → Enable "Demo Mode"
3. Wait 30 seconds → Quiz appears!
4. Click concept tag → Google search opens
5. Answer question → Video resumes
6. Next quiz in 30 seconds

## Tech Stack
=======
- Python (core AI service)
- spaCy (keyword/entity extraction, NLP basics)
- sentence-transformers + FAISS (semantic grouping and retrieval)
- LLM provider:
  - Google Gemini API, or
  - Local models via Ollama (LLaMA, Mistral)
>>>>>>> b34756bfd62230f4f9cbf47cc29669cde384a7f7

### Backend
- FastAPI (Python)
- Hugging Face Inference API (Mistral-7B)
- MongoDB (optional, uses in-memory storage)
- YouTube Transcript API

### Extension
- TypeScript
- React (quiz overlay)
- Chrome Extension API (Manifest V3)
- Shadow DOM (CSS isolation)

## Project Structure

```
Obsidian-Elite_edtech/
├── backend/
│   ├── api/
│   │   ├── routes/
│   │   │   ├── free_generation.py    # Question generation API
│   │   │   └── transcription.py      # YouTube transcript API
│   │   └── main.py                   # FastAPI app
│   ├── services/
│   │   ├── free_question_generation.py  # Hugging Face integration
│   │   └── in_memory_storage.py         # MongoDB fallback
│   └── requirements.txt
│
└── extension/
    ├── dist/                          # Built extension (load this)
    │   ├── content_script.js
    │   ├── popup.js
    │   ├── background.js
    │   ├── manifest.json
    │   └── popup.html
    │
    └── src/
        ├── content/
        │   ├── content_script.ts      # Main logic
        │   └── quiz_overlay.tsx       # Quiz UI
        ├── popup/
        │   ├── Popup.tsx              # Extension popup
        │   └── Dashboard.tsx          # Stats display
        └── background/
            └── background.ts          # Service worker
```

## Development

### Backend Setup

<<<<<<< HEAD
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

### Extension Build
=======
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
>>>>>>> b34756bfd62230f4f9cbf47cc29669cde384a7f7

```bash
cd extension
npm install
npm run build
```

Built files go to `extension/dist/`

## How It Works

1. **Extension initializes** when video page loads
2. **Backend fetches transcript** from YouTube captions
3. **Timer starts** (30s demo / 5min normal)
4. **Video pauses** at checkpoint
5. **AI generates question** using Hugging Face (1-3s)
6. **Quiz overlay appears** with 4 options
7. **User answers** (keyboard: 1-4, Enter)
8. **Feedback shown** (correct/wrong + explanation)
9. **Video resumes** automatically
10. **Stats update** in popup
11. **Next quiz** after interval

## Unique Features

### Unique Questions
- Tracks asked concepts per session
- AI avoids duplicate topics
- Each quiz covers new material
- Progressive learning experience

### Clickable Concepts
- Click concept tag → Google search
- Magnifying glass icon (🔍)
- Opens in new tab
- Quick research tool

## Configuration

### Demo Mode
- 30-second intervals
- For testing
- Toggle in popup

### Normal Mode
- 5-minute intervals
- For real learning
- Default mode

## Requirements

### Backend
- Python 3.8+
- Internet connection (Hugging Face API)
- MongoDB (optional)

### Extension
- Chrome browser
- Videos with captions/subtitles

## Troubleshooting

### Backend won't start
```bash
pip install -r requirements.txt
```

### Extension won't load
- Load `extension/dist` folder (not `extension/src`)
- Check all files exist in dist/

### No quiz appears
- Check Demo Mode is enabled
- Video must have captions
- Check console for errors (F12)

### Questions repeat
- Each session tracks unique concepts
- Restart backend to reset tracking

## License

MIT

## Support

For issues, check console logs (F12) for `[LP]` prefixed messages.
