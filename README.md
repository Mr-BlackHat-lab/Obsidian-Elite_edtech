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

### 3. Test

1. Open: https://www.youtube.com/watch?v=_uQrJ0TkZlc
2. Click extension icon → Enable "Demo Mode"
3. Wait 30 seconds → Quiz appears!
4. Click concept tag → Google search opens
5. Answer question → Video resumes
6. Next quiz in 30 seconds

## Tech Stack

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

Goal: `Video -> Questions`

<div align="center">

<img src="https://img.shields.io/badge/-%F0%9F%A7%A0%20LearnPulse%20AI-1976D2?style=for-the-badge&labelColor=0D47A1" height="50"/>

### Turn Passive Video Watching into Active Learning

<p>
  <img src="https://img.shields.io/badge/Python-3.11+-1565C0?style=flat-square&logo=python&logoColor=white"/>
  <img src="https://img.shields.io/badge/FastAPI-0.111+-00695C?style=flat-square&logo=fastapi&logoColor=white"/>
  <img src="https://img.shields.io/badge/MongoDB-7.0+-2E7D32?style=flat-square&logo=mongodb&logoColor=white"/>
  <img src="https://img.shields.io/badge/Redis-7.0+-B71C1C?style=flat-square&logo=redis&logoColor=white"/>
  <img src="https://img.shields.io/badge/Docker-Compose-0277BD?style=flat-square&logo=docker&logoColor=white"/>
  <img src="https://img.shields.io/badge/TypeScript-5.0+-1565C0?style=flat-square&logo=typescript&logoColor=white"/>
  <img src="https://img.shields.io/badge/GitHub-OAuth-212121?style=flat-square&logo=github&logoColor=white"/>
  <img src="https://img.shields.io/badge/JWT-Auth-37474F?style=flat-square&logo=jsonwebtokens&logoColor=white"/>
</p>

<p><b>LearnPulse AI</b> converts any YouTube video or live stream into an interactive quiz — in real time.<br/>Stop watching passively. Start learning actively.</p>

**[🚀 Quick Start](#-getting-started)** &nbsp;•&nbsp; **[📡 API](#-api-reference)** &nbsp;•&nbsp; **[🏗️ Architecture](#-system-architecture)** &nbsp;•&nbsp; **[🔐 Auth](#-authentication-flow)** &nbsp;•&nbsp; **[🤝 Contribute](#-contributing)**

</div>

---

## 🖥️ Preview

<table>
<tr>
<td width="50%">

**Quiz Overlay on YouTube**

```
╔══════════════════════════════════════╗
║  ▶  Intro to Machine Learning 08:42  ║
╠══════════════════════════════════════╣
║  🧠  Quick Check — Neural Networks   ║
║  ────────────────────────────────────║
║  What is the purpose of a loss fn?   ║
║                                      ║
║  ○  A) Initialize weights            ║
║  ●  B) Measure prediction error  ✓   ║
║  ○  C) Normalize input data          ║
║  ○  D) Split the dataset             ║
║                                      ║
║  ████████████████░░░░  Score: 85%    ║
║  Topic: Neural Networks · Medium     ║
╚══════════════════════════════════════╝
```

</td>
<td width="50%">

**Performance Dashboard**

```
╔═════════════════════════════════════╗
║  📊  Performance Report            ║
║  ────────────────────────────────── ║
║  Overall Accuracy      85%  17/20   ║
║  Total Sessions          5          ║
║  Total Questions        40          ║
║  ────────────────────────────────── ║
║  Neural Networks   ████████  90%    ║
║  Backpropagation   ██████░░  70%    ║
║  Optimization      ████░░░░  55% ⚠ ║
║  Loss Functions    ██████████100%   ║
║  ────────────────────────────────── ║
║  ⚠ Weak: Optimization              ║
║  💡 Revise before next session     ║
╚═════════════════════════════════════╝
```

</td>
</tr>
</table>

---

## ✨ Features

<table>
<tr>
<td width="50%">

| Feature                       | Status  |
| ----------------------------- | ------- |
| 🎥 YouTube URL → instant quiz | ✅ Live |
| 🔴 Live stream real-time quiz | ✅ Live |
| 🧠 Google Gemini AI questions | ✅ Live |
| 📊 Performance & analytics    | ✅ Live |
| ⚡ Adaptive difficulty engine | ✅ Live |

</td>
<td width="50%">

| Feature                     | Status  |
| --------------------------- | ------- |
| 🔐 JWT login / signup       | ✅ Live |
| 🐙 GitHub OAuth             | ✅ Live |
| 👤 Full user CRUD           | ✅ Live |
| 🔄 Celery async workers     | ✅ Live |
| 🌐 Chrome extension overlay | ✅ Live |

</td>
</tr>
</table>

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT  LAYER                              │
│                                                                     │
│   ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│   │  🌐  Browser     │ │  🔌  Chrome      │  │  💻  Python      │ │
│   │     Frontend     │  │    Extension     │  │      CLI         │  │
│   │                  │  │  (TypeScript)    │  │    (Click)       │  │
│   └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘  │
└────────────┼────────────────────┼────────────────────┼──────────────┘
             └────────────────────┼────────────────────┘
                                  │  HTTP REST / WebSocket
┌─────────────────────────────────▼───────────────────────────────────┐
│                        FASTAPI  BACKEND  (Python 3.11+)             │
│                                                                     │
│  ┌───────────────────┐  ┌────────────────────┐  ┌────────────────┐  │
│  │   🔐  /auth/*     │ │   👤  /users/*     │  │  🎓  Learning  │  │
│  │                   │  │                    │  │                │  │
│  │  POST /register   │  │  GET    /me        │  │  POST /transcr │  │
│  │  POST /login      │  │  PUT    /me        │  │  POST /gen-q   │  │
│  │  GET  /github     │  │  DELETE /me        │  │  POST /submit  │  │
│  │  GET  /callback   │  │  GET    /{id}      │  │  GET  /session │  │
│  │                   │  │  GET    /          │  │  GET  /perf    │  │
│  │  JWT + bcrypt     │  │  JWT Protected     │  │  WS   /ws/live │  │
│  │  GitHub OAuth     │  │  Pagination        │  │                │  │
│  └───────────────────┘  └───────────────────┘  └─────────────────┘  │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
             ┌─────────────────────┼─────────────────────┐
             │                     │                     │
┌────────────▼──────────┐ ┌────────▼───────────┐ ┌───────▼─────────────┐
│       MongoDB         │ │       Redis        │ │   Celery  Worker    │
│                       │ │                    │ │                     │
│  users                │ │  Task queue        │ │  process_video_task │
│  sessions             │ │  Video cache       │ │  Transcription      │
│  questions            │ │  Live buffers      │ │  Question gen       │
│  attempts             │ │  OAuth state       │ │  Concept extract    │
└───────────────────────┘ └────────────────────┘ └──────────┬──────────┘
                                                             │
                                              ┌─────────────▼──────────┐
                                              │     AI / NLP  Layer    │
                                              │                        │
                                              │  Google Gemini API     │
                                              │  spaCy  (NLP)          │
                                              │  FAISS  (Semantic)     │
                                              │  sentence-transformers │
                                              └────────────────────────┘
```

---

## 🔐 Authentication Flow

```
  Client                                          FastAPI Backend
    │                                                    │
    │  ─────────────── SIGNUP ──────────────────────     │
    │                                                    │
    │  POST /auth/register                               │
    │  { username, email, password } ──────────────────► │
    │                                                    ├── check duplicate username
    │                                                    ├── check duplicate email
    │                                                    ├── bcrypt.hash(password)
    │                                                    ├── save to MongoDB
    │  { user_id, username, token } ◄─────────────────── ├── generate JWT
    │                                                    │
    │  ─────────────── LOGIN ───────────────────────     │
    │                                                    │
    │  POST /auth/login                                  │
    │  { username, password } ─────────────────────────► │
    │                                                    ├── find user in MongoDB
    │                                                    ├── bcrypt.verify(password)
    │  { user_id, username, token } ◄─────────────────── ├── generate JWT
    │                                                    │
    │  ─────────────── GITHUB OAUTH ────────────────     │
    │                                                    │
    │  GET /auth/github ───────────────────────────────► │
    │  ◄──────── 302 → GitHub Login Page ─────────────── │
    │                                                    │
    │  GET /auth/github/callback ──────────────────────► │
    │                                                    ├── exchange code → token
    │                                                    ├── GET api.github.com/user
    │                                                    ├── GET /user/emails
    │                                                    ├── get or create user in DB
    │  ◄──── 302 Redirect /?token=<JWT> ──────────────── ├── generate JWT
    │                                                    │
    │  ─────────────── PROTECTED ───────────────────     │
    │                                                    │
    │  GET /users/me                                     │
    │  Authorization: Bearer <JWT> ────────────────────► │
    │                                                    ├── decode JWT
    │                                                    ├── validate signature
    │  { user profile } ◄──────────────────────────────  ├── return user data
```

---

## 🎓 Video Processing Flow

```
  POST /transcribe { video_url, user_id }
           │
           ▼
  ┌─────────────────────────┐
  │  Session already exists?├──── YES ──► return cached session_id ✅
  └────────────┬────────────┘
               │ NO
               ▼
  ┌─────────────────────────┐
  │  Create MongoDB session │  status: "processing"
  └────────────┬────────────┘
               │
               ▼
  ┌─────────────────────────┐
  │  Celery async task      │──► return session_id to user immediately
  │  process_video_task()   │
  └────────────┬────────────┘
               │
        ┌──────┴──────┐
        ▼             ▼
  ┌───────────┐  ┌──────────────────┐
  │  YouTube  │  │  Whisper/Gemini  │
  │  Captions │  │  Transcription   │
  │  (fast)   │  │  (fallback)      │
  └─────┬─────┘  └────────┬─────────┘
        └────────┬─────────┘
                 │  transcript text
                 ▼
  ┌─────────────────────────┐
  │  spaCy Concept Extract  │  → keywords, entities
  └────────────┬────────────┘
               ▼
  ┌─────────────────────────┐
  │  FAISS Semantic Group   │  → concept clusters
  └────────────┬────────────┘
               ▼
  ┌─────────────────────────┐
  │  Gemini Question Gen    │  Easy / Medium / Hard
  │  MCQ / Short / T-F      │
  └────────────┬────────────┘
               ▼
  ┌─────────────────────────┐
  │  Save to MongoDB        │  status: "ready" ✅
  └─────────────────────────┘
```

---

## 🔴 Live Stream Flow

```
  Chrome Extension          WebSocket /ws/live            Backend
        │                          │                         │
        │── connect(session_id) ──►│                         │
        │                          │◄── accept connection ───│
        │                          │                         │
        │── { audio_base64 } ─────►│                         │
        │                          │── transcribe chunk ────►│
        │                          │◄── chunk_text ──────────│
        │                          │── save to Redis buffer  │
        │                          │── quiz trigger check?   │
        │                          │── extract concepts ────►│
        │                          │── generate question ───►│ Gemini
        │                          │◄── question ────────────│
        │◄── { SHOW_QUIZ, q } ─────│                         │
        │                          │                         │
        │── POST /submit-answer ──►│                         │
        │◄── { correct, score } ───│                         │
```

---

## 📊 Adaptive Difficulty Engine

```
  ┌───────────────────────────────────────────────────────┐
  │              ADAPTIVE DIFFICULTY LOGIC                │
  ├───────────────────────────────────────────────────────┤
  │                                                       │
  │   Score < 0.40        →   🟢  EASY    (recall)       │
  │   0.40 ≤ score ≤ 0.70 →   🟡  MEDIUM  (explain)      │
  │   Score > 0.70        →   🔴  HARD    (apply/analyze)│
  │                                                      │
  │   Weak Topic Rule:                                   │
  │   accuracy < 60%  AND  attempts ≥ 2  =  ⚠ weak      │
  │                                                      │
  └──────────────────────────────────────────────────────┘
```

---

## 📡 API Reference

### 🔐 Auth — `backend/api/routes/auth.py`

| Method | Endpoint                | Auth | Description                   |
| ------ | ----------------------- | ---- | ----------------------------- |
| `POST` | `/auth/register`        | ❌   | Create account → returns JWT  |
| `POST` | `/auth/login`           | ❌   | Login → returns JWT           |
| `GET`  | `/auth/github`          | ❌   | Redirect to GitHub login      |
| `GET`  | `/auth/github/callback` | ❌   | GitHub callback → returns JWT |

<details>
<summary>📋 Request / Response examples</summary>

**Register**

```json
// POST /auth/register
{ "username": "john_doe", "email": "john@example.com", "password": "secret" }

// Response
{ "user_id": "abc123xyz", "username": "john_doe", "token": "eyJ..." }
```

**Login**

```json
// POST /auth/login
{ "username": "john_doe", "password": "secret" }

// Response
{ "user_id": "abc123xyz", "username": "john_doe", "token": "eyJ..." }
```

</details>

---

### 👤 Users CRUD — `backend/api/routes/users.py`

| Method   | Endpoint                  | Auth   | Description                        |
| -------- | ------------------------- | ------ | ---------------------------------- |
| `GET`    | `/users/me`               | ✅ JWT | Get own profile                    |
| `PUT`    | `/users/me`               | ✅ JWT | Update username / email / password |
| `DELETE` | `/users/me`               | ✅ JWT | Delete own account                 |
| `GET`    | `/users/{user_id}`        | ✅ JWT | Get any user by ID                 |
| `GET`    | `/users/?skip=0&limit=20` | ✅ JWT | List all users paginated           |

<details>
<summary>📋 Request / Response examples</summary>

```json
// PUT /users/me
{ "username": "new_name", "email": "new@email.com", "password": "newpass" }

// DELETE /users/me
{ "message": "Account deleted successfully", "user_id": "abc123xyz" }
```

</details>

---

### 🎓 Learning — `backend/api/routes/transcription.py` + `performance.py`

| Method | Endpoint                 | Auth | Description                           |
| ------ | ------------------------ | ---- | ------------------------------------- |
| `POST` | `/transcribe`            | ❌   | Submit YouTube URL → async processing |
| `POST` | `/generate-questions`    | ❌   | Generate questions from transcript    |
| `POST` | `/submit-answer`         | ❌   | Submit answer → get score update      |
| `GET`  | `/session/{session_id}`  | ❌   | Get session details                   |
| `GET`  | `/performance/{user_id}` | ❌   | Get full performance report           |
| `WS`   | `/ws/live`               | ❌   | Live stream quiz WebSocket            |

<details>
<summary>📋 Request / Response examples</summary>

**Transcribe**

```json
// POST /transcribe
{ "video_url": "https://youtube.com/watch?v=abc", "user_id": "user_001" }

// Response
{ "session_id": "a1b2c3d4e5f6", "status": "processing", "reused": false }
```

**Submit Answer**

```json
// POST /submit-answer
{ "session_id": "a1b2c3", "question_id": "q_001", "user_answer": "B", "concept_tag": "neural_networks" }

// Response
{ "correct": true, "explanation": "Loss fn measures prediction error.", "updated_score": 0.85, "weak_topics": ["optimization"] }
```

**Performance**

```json
// GET /performance/user_001
{
  "overall_accuracy": 0.85,
  "total_sessions": 5,
  "total_questions": 40,
  "topic_breakdown": {
    "neural_networks": { "correct": 9, "total": 10, "accuracy": 0.9 },
    "optimization": { "correct": 3, "total": 6, "accuracy": 0.5 }
  },
  "weak_topics": ["optimization"],
  "feedback": "Revise optimization before next session."
}
```

</details>

---

## 📁 Project Structure

```
Obsidian-Elite_edtech/
│
├── backend/                        ← FastAPI Python backend
│   ├── api/
│   │   ├── main.py                 ← App entry, middleware, routers
│   │   └── routes/
│   │       ├── auth.py             ← ✅ Login, signup, GitHub OAuth, JWT
│   │       ├── users.py            ← ✅ User CRUD
│   │       ├── transcription.py    ← ✅ Video processing + WebSocket
│   │       └── performance.py      ← ✅ Scores, analytics, weak topics
│   ├── models/
│   │   ├── user.py                 ← User schema + request models
│   │   ├── session.py              ← Session + answer models
│   │   └── question.py             ← Question schema
│   ├── services/
│   │   ├── transcription.py        ← Whisper / Gemini transcription
│   │   ├── question_generation.py  ← Gemini question generation
│   │   ├── concept_extraction.py   ← spaCy + FAISS concept engine
│   │   ├── difficulty_engine.py    ← Adaptive difficulty logic
│   │   └── live_stream.py          ← Live audio buffer + quiz trigger
│   ├── workers/
│   │   └── celery_tasks.py         ← Async video processing
│   ├── .env                        ← Local dev environment
│   ├── Dockerfile
│   └── requirements.txt
│
├── cli/                            ← Python CLI tool
│   ├── commands/
│   │   ├── process.py              ← process command
│   │   ├── generate_test.py        ← test command
│   │   └── show_progress.py        ← progress command
│   └── main.py
│
├── extension/                      ← Chrome browser extension
│   ├── src/
│   │   ├── background/             ← Service worker
│   │   ├── content/                ← Quiz overlay injection
│   │   └── popup/                  ← Extension popup UI
│   └── manifest.json
│
├── docs/                           ← Developer guides
├── docker-compose.yml              ← Full stack orchestration
├── .env                            ← Root environment variables
└── README.md
```

---

## ⚙️ Tech Stack

<table>
<tr><th>Layer</th><th>Technology</th></tr>
<tr><td>Backend API</td><td>FastAPI 0.111+, Python 3.11+, Uvicorn</td></tr>
<tr><td>Database</td><td>MongoDB 7.0 — Motor async driver</td></tr>
<tr><td>Cache / Queue</td><td>Redis 7.0 + Celery 5.4</td></tr>
<tr><td>AI / NLP</td><td>Google Gemini, spaCy, FAISS, sentence-transformers</td></tr>
<tr><td>Auth</td><td>JWT (python-jose), bcrypt (passlib), GitHub OAuth (authlib)</td></tr>
<tr><td>Browser Extension</td><td>TypeScript, React, Webpack, Manifest V3</td></tr>
<tr><td>CLI</td><td>Click (Python)</td></tr>
<tr><td>DevOps</td><td>Docker, Docker Compose</td></tr>
</table>

---

## 🛠️ Getting Started

### Prerequisites

<table>
<tr><td>🐳 Docker Desktop</td><td>Running</td></tr>
<tr><td>🐍 Python</td><td>3.11+</td></tr>
<tr><td>🟢 Node.js</td><td>18+ (extension only)</td></tr>
<tr><td>🤖 Gemini API Key</td><td><a href="https://makersuite.google.com/app/apikey">Get here</a></td></tr>
<tr><td>🐙 GitHub OAuth App</td><td><a href="https://github.com/settings/developers">Create here</a></td></tr>
</table>

### 1 — Clone & Configure

```bash
git clone https://github.com/Mr-BlackHat-lab/Obsidian-Elite_edtech.git
cd Obsidian-Elite_edtech
cp .env.example .env
```

```env
# .env
GEMINI_API_KEY=your_gemini_api_key
JWT_SECRET=supersecretkey
JWT_ALGORITHM=HS256
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
MONGODB_URL=mongodb://mongo:27017/learnpulse
REDIS_URL=redis://redis:6379/0
```

### 2 — Run with Docker

```bash
docker-compose up --build
```

```
✅  Backend API    →  http://localhost:8000
✅  MongoDB        →  localhost:27017
✅  Redis          →  localhost:6379
✅  Celery Worker  →  background
```

### 3 — Verify

```bash
curl http://localhost:8000/health
# { "status": "ok", "service": "LearnPulse AI" }
```

### 4 — API Docs

```
http://localhost:8000/docs     ← Swagger UI
http://localhost:8000/redoc    ← ReDoc
```

### 5 — CLI

```bash
cd cli && pip install -r requirements.txt

python main.py process  --url "https://youtube.com/watch?v=your_video"
python main.py test     --session-id <session_id>
python main.py progress --user-id <user_id>
python main.py test     --session-id <session_id> --export-path results.json
```

### 6 — Chrome Extension

```bash
cd extension && npm install && npm run build
```

1. Open `chrome://extensions/`
2. Enable **Developer Mode**
3. Click **Load unpacked** → select `extension/` folder
4. Open any YouTube video → quiz overlay appears automatically

### 7 — Integration Setup (backend + CLI + extension + frontend)

Use these local values for a working end-to-end setup:

```env
# Backend
MONGODB_URL=mongodb://mongo:27017/learnpulse
REDIS_URL=redis://redis:6379/0
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173

# CLI
BACKEND_URL=http://localhost:8000

# Frontend
VITE_API_BASE_URL=http://localhost:8000
API_BASE_URL=http://localhost:8000

# Extension
backend host permission: http://localhost:8000/* and http://127.0.0.1:8000/*
```

Recommended startup order:

1. `docker compose up --build -d`
2. Verify backend: `http://localhost:8000/health`
3. Run CLI commands from `cli/`
4. Build/load extension from `extension/dist/`
5. Run frontend with `npm run dev` inside `frontend/front/`

Frontend endpoints now target the FastAPI backend directly:

- `POST /auth/register`
- `POST /auth/login`
- `GET /users/me`
- `GET /performance/{user_id}`

---

## 🌐 GitHub OAuth Setup

```
1. https://github.com/settings/developers → New OAuth App
2. Homepage URL  →  http://localhost:8000
3. Callback URL  →  http://localhost:8000/auth/github/callback
4. Copy Client ID + Secret → paste into .env
```

---

## 🤝 Contributing

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

⭐ Star this repo if you find it useful!

</div>
