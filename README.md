<div align="center">

# 🧠 LearnPulse AI

### Turn Passive Video Watching into Active Learning

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.0+-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://mongodb.com)
[![Redis](https://img.shields.io/badge/Redis-7.0+-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://docker.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![GitHub OAuth](https://img.shields.io/badge/GitHub-OAuth-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com)
[![JWT](https://img.shields.io/badge/JWT-Auth-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white)](https://jwt.io)

> **LearnPulse AI** is an intelligent EdTech platform that converts any YouTube video or live stream into an interactive quiz experience — in real time. Stop watching passively. Start learning actively.

[🚀 Quick Start](#️-getting-started) • [📡 API Docs](#-api-reference) • [🏗️ Architecture](#️-system-architecture) • [🔐 Auth](#-authentication-flow) • [🤝 Contributing](#-contributing)

</div>

---

## 📸 What It Looks Like

```
╔══════════════════════════════════════════════════════════════════╗
║                    🎬  YouTube Video Player                      ║
║  ┌────────────────────────────────────────────────────────────┐  ║
║  │  ▶  Introduction to Machine Learning          [08:42] ──  │  ║
║  └────────────────────────────────────────────────────────────┘  ║
║                                                                  ║
║  ╔══════════════════ 🧠 QUIZ OVERLAY ═══════════════════════╗   ║
║  ║                                                           ║   ║
║  ║  Quick Check! — Neural Networks                           ║   ║
║  ║  ─────────────────────────────────────────────────────    ║   ║
║  ║  What is the main purpose of a loss function?             ║   ║
║  ║                                                           ║   ║
║  ║   ○  A) To initialize model weights                       ║   ║
║  ║   ●  B) To measure prediction error              ✓ +10    ║   ║
║  ║   ○  C) To normalize the input data                       ║   ║
║  ║   ○  D) To split the training dataset                     ║   ║
║  ║                                                           ║   ║
║  ║  ████████████████████░░░░  Score: 85%                     ║   ║
║  ║  Topic: Neural Networks  |  Difficulty: Medium            ║   ║
║  ╚═══════════════════════════════════════════════════════════╝   ║
╚══════════════════════════════════════════════════════════════════╝
```

```
╔══════════════════════════════════════════════════════════════════╗
║                  📊  Performance Dashboard                       ║
║                                                                  ║
║   Overall Accuracy          Topic Breakdown                      ║
║   ┌──────────────┐          ┌─────────────────────────────┐      ║
║   │     85%      │          │ Neural Networks   ████ 90%  │      ║
║   │  ████████░░  │          │ Backpropagation   ███░ 70%  │      ║
║   │  17/20 ✓     │          │ Optimization      ██░░ 55% ⚠│     ║
║   └──────────────┘          │ Loss Functions    █████100% │      ║
║                             └─────────────────────────────┘      ║
║   ⚠ Weak Topics: Optimization                                   ║
║   💡 Revise "Optimization" before your next session             ║
╚══════════════════════════════════════════════════════════════════╝
```

---

## 🚀 Key Features

| Feature | Description | Status |
|---------|-------------|--------|
| 🎥 **Video-to-Quiz** | Paste any YouTube URL → get instant quizzes | ✅ Live |
| 🔴 **Live Stream Quiz** | Real-time quiz from live audio via WebSocket | ✅ Live |
| 🧠 **AI-Powered** | Google Gemini generates contextual questions | ✅ Live |
| 📊 **Performance Tracking** | Track scores, weak topics, progress over time | ✅ Live |
| 🔐 **JWT Auth** | Secure login/signup with bcrypt + JWT tokens | ✅ Live |
| 🐙 **GitHub OAuth** | One-click login with GitHub account | ✅ Live |
| 👤 **User CRUD** | Full profile management (read/update/delete) | ✅ Live |
| ⚡ **Adaptive Difficulty** | Easy → Medium → Hard based on your score | ✅ Live |
| 🔄 **Celery Workers** | Async video processing with Redis queue | ✅ Live |
| 🌐 **Browser Extension** | Chrome extension with in-video quiz overlay | ✅ Live |
| 🖥️ **Python CLI** | Command-line tool for processing & testing | ✅ Live |

---

## 🏗️ System Architecture

```
╔══════════════════════════════════════════════════════════════════════╗
║                         CLIENT LAYER                                 ║
║                                                                      ║
║   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      ║
║   │  🌐 Browser     │ │  🔌 Chrome      │  │  💻 Python      │     ║
║   │     Frontend    │  │    Extension    │  │      CLI        │      ║
║   │                 │  │  (TypeScript)   │  │    (Click)      │      ║
║   └────────┬────────┘  └────────┬────────┘  └────────┬────────┘      ║
╚════════════╪════════════════════╪════════════════════╪═══════════════╝
             │                   │                    │
             └───────────────────┼────────────────────┘
                                 │
                          HTTP REST / WebSocket
                                 │
╔════════════════════════════════▼═════════════════════════════════════╗
║                        FASTAPI BACKEND                               ║
║                         (Python 3.11+)                               ║
║                                                                      ║
║  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐    ║
║  │   🔐 /auth/*     │  │   👤 /users/*   │  │  🎓 Learning     │   ║
║  │                  │  │                  │  │                  │    ║
║  │ POST /register   │  │ GET    /me       │  │ POST /transcribe │    ║
║  │ POST /login      │  │ PUT    /me       │  │ POST /generate-  │    ║
║  │ GET  /github     │  │ DELETE /me       │  │      questions   │    ║
║  │ GET  /github/    │  │ GET    /{id}     │  │ POST /submit-    │    ║
║  │      callback    │  │ GET    /         │  │      answer      │    ║
║  │                  │  │                  │  │ GET  /session/   │    ║
║  │ JWT + bcrypt     │  │ JWT Protected    │  │ GET  /performance│    ║
║  │ GitHub OAuth     │  │ Pagination       │  │ WS   /ws/live    │    ║
║  └──────────────────┘  └──────────────────┘  └──────────────────┘    ║
╚══════════════════════════════════╪═══════════════════════════════════╝
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
╔═════════════▼══════╗  ╔══════════▼═════════╗  ╔══════▼══════════════╗
║     MongoDB        ║  ║       Redis        ║  ║   Celery Worker     ║
║                    ║  ║                    ║  ║                     ║
║  users collection  ║  ║  Task queue        ║  ║  process_video_task ║
║  sessions          ║  ║  Video cache       ║  ║  Transcription      ║
║  questions         ║  ║  Live buffers      ║  ║  Question gen       ║
║  attempts          ║  ║  OAuth state       ║  ║  Concept extract    ║
╚════════════════════╝  ╚════════════════════╝  ╚══════════╪══════════╝
                                                            │
                                               ╔════════════▼═══════════╗
                                               ║    AI / NLP Layer      ║
                                               ║                        ║
                                               ║  Google Gemini API     ║
                                               ║  spaCy (NLP)           ║
                                               ║  FAISS (Semantic)      ║
                                               ║  sentence-transformers ║
                                               ╚════════════════════════╝
```

---

## 🔐 Authentication Flow

```
┌──────────┐                                      ┌──────────────────┐
│  Client  │                                      │  FastAPI Backend │
└────┬─────┘                                      └────────┬─────────┘
     │                                                     │
     │  ══════════════ NORMAL SIGNUP ══════════════════    │
     │                                                     │
     │  POST /auth/register                                │
     │  { username, email, password }  ──────────────────► │
     │                                                     ├─ check duplicate username
     │                                                     ├─ check duplicate email
     │                                                     ├─ bcrypt hash password
     │                                                     ├─ save User to MongoDB
     │  { user_id, username, token }  ◄────────────────── ├─ generate JWT token
     │                                                     │
     │  ══════════════ NORMAL LOGIN ═══════════════════    │
     │                                                     │
     │  POST /auth/login                                   │
     │  { username, password }  ──────────────────────── ► │
     │                                                     ├─ find user in MongoDB
     │                                                     ├─ bcrypt.verify(password)
     │  { user_id, username, token }  ◄────────────────── ├─ generate JWT token
     │                                                     │
     │  ══════════════ GITHUB OAUTH ═══════════════════    │
     │                                                     │
     │  GET /auth/github  ────────────────────────────── ► │
     │  ◄──────── 302 Redirect to GitHub Login ─────────── │
     │                                                     │
     │  [User logs in on GitHub]                           │
     │                                                     │
     │  GET /auth/github/callback  ───────────────────── ► │
     │                                                     ├─ exchange code for token
     │                                                     ├─ GET github.com/user
     │                                                     ├─ GET github.com/user/emails
     │                                                     ├─ get or create user in DB
     │  ◄──── 302 Redirect /?token=<JWT> ──────────────── ├─ generate JWT token
     │                                                     │
     │  ══════════════ PROTECTED ROUTES ══════════════     │
     │                                                     │
     │  GET /users/me                                      │
     │  Authorization: Bearer <JWT>  ─────────────────── ► │
     │                                                     ├─ decode JWT
     │                                                     ├─ validate signature
     │  { user profile }  ◄──────────────────────────────  ├─ return user data
     │                                                     │
└────┴─────┘                                      └────────┴─────────┘
```

---

## 🎓 Video Processing Flow

```
  User Input
      │
      │  POST /transcribe
      │  { video_url, user_id }
      ▼
╔═════════════════════════════╗
║   Check existing session    ║  ──► Already exists? Return cached session ✅
╚══════════════╪══════════════╝
               │ New video
               ▼
╔═════════════════════════════╗
║   Create session in MongoDB ║
║   status: "processing"      ║
╚══════════════╪══════════════╝
               │
               ▼
╔═════════════════════════════╗
║   Celery Task (async)       ║  ──► Returns session_id immediately to user
║   process_video_task.delay()║
╚══════════════╪══════════════╝
               │
       ┌───────┴────────┐
       │                │
       ▼                ▼
╔════════════╗   ╔══════════════════╗
║  YouTube   ║   ║  Whisper/Gemini  ║
║  Captions  ║   ║  Transcription   ║
║  (fast)    ║   ║  (fallback)      ║
╚═════╪══════╝   ╚════════╪═════════╝
       └───────┬────────┘
               │  transcript text
               ▼
╔═════════════════════════════╗
║   spaCy Concept Extraction  ║
║   → keywords, entities      ║
╚══════════════╪══════════════╝
               │
               ▼
╔═════════════════════════════╗
║   FAISS Semantic Grouping   ║
║   → concept clusters        ║
╚══════════════╪══════════════╝
               │
               ▼
╔═════════════════════════════╗
║   Gemini Question Generator ║
║   Easy  / Medium / Hard     ║
║   MCQ   / Short / True-False║
╚══════════════╪══════════════╝
               │
               ▼
╔═════════════════════════════╗
║   Save to MongoDB session   ║
║   status: "ready" ✅        ║
╚═════════════════════════════╝
```

---

## 🔴 Live Stream Flow

```
Chrome Extension                  WebSocket /ws/live              Backend
      │                                   │                          │
      │── connect(session_id, user_id) ──►│                          │
      │                                   │◄─── accept connection ───│
      │                                   │                          │
      │── { audio_base64: "..." } ───────►│                          │
      │                                   │── transcribe chunk ─────►│
      │                                   │◄── chunk_text ───────────│
      │                                   │                          │
      │                                   │── save to Redis buffer   │
      │                                   │── check quiz trigger?    │
      │                                   │                          │
      │                                   │── extract concepts ─────►│
      │                                   │── find new concept       │
      │                                   │── generate question ────►│ Gemini
      │                                   │◄── question ─────────────│
      │                                   │                          │
      │◄── { type: "SHOW_QUIZ",           │                          │
      │      question: {...} } ───────────│                          │
      │                                   │                          │
      │── [user answers] ────────────────►│ POST /submit-answer      │
      │◄── { correct, score, feedback } ──│                          │
```

---

## 📡 API Reference

### 🔐 Auth Endpoints
> All implemented in `backend/api/routes/auth.py`

| Method | URL | Auth | Description | Status |
|--------|-----|------|-------------|--------|
| `POST` | `/auth/register` | ✅ | Create new account | ✅ Implemented |
| `POST` | `/auth/login` | ✅ | Login, receive JWT | ✅ Implemented |
| `GET` | `/auth/github` | ✅ | Start GitHub OAuth | ✅ Implemented |
| `GET` | `/auth/github/callback` | ✅ | GitHub OAuth callback | ✅ Implemented |

**Register request:**
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "securepassword"
}
```
**Register / Login response:**
```json
{
  "user_id": "abc123",
  "username": "john_doe",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### 👤 User CRUD Endpoints
> All implemented in `backend/api/routes/users.py`

| Method | URL | Auth | Description | Status |
|--------|-----|------|-------------|--------|
| `GET` | `/users/me` | ✅ JWT | Get own profile | ✅ Implemented |
| `PUT` | `/users/me` | ✅ JWT | Update username/email/password | ✅ Implemented |
| `DELETE` | `/users/me` | ✅ JWT | Delete own account | ✅ Implemented |
| `GET` | `/users/{user_id}` | ✅ JWT | Get any user by ID | ✅ Implemented |
| `GET` | `/users/?skip=0&limit=20` | ✅ JWT | List all users paginated | ✅ Implemented |

**Update profile request:**
```json
{
  "username": "new_username",
  "email": "new@example.com",
  "password": "newpassword"
}
```

---

### 🎓 Learning Endpoints
> All implemented in `backend/api/routes/transcription.py` and `performance.py`

| Method | URL | Auth | Description | Status |
|--------|-----|------|-------------|--------|
| `POST` | `/transcribe` | ✅ | Submit YouTube URL for processing | ✅ Implemented |
| `POST` | `/generate-questions` | ✅ | Generate questions from transcript | ✅ Implemented |
| `POST` | `/submit-answer` | ✅ | Submit answer, get score update | ✅ Implemented |
| `GET` | `/session/{session_id}` | ✅ | Get session details | ✅ Implemented |
| `GET` | `/performance/{user_id}` | ✅ | Get user performance report | ✅ Implemented |
| `WS` | `/ws/live` | ✅ | Live stream quiz WebSocket | ✅ Implemented |

**Transcribe request:**
```json
{
  "video_url": "https://www.youtube.com/watch?v=abc123",
  "user_id": "user_001"
}
```
**Transcribe response:**
```json
{
  "session_id": "a1b2c3d4e5f6",
  "status": "processing",
  "reused": false
}
```

**Submit answer request:**
```json
{
  "session_id": "a1b2c3d4e5f6",
  "question_id": "q_001",
  "user_answer": "B",
  "concept_tag": "neural_networks"
}
```
**Submit answer response:**
```json
{
  "correct": true,
  "explanation": "Loss function measures the difference between predicted and actual values.",
  "updated_score": 0.85,
  "weak_topics": ["optimization"]
}
```

**Performance response:**
```json
{
  "user_id": "user_001",
  "overall_accuracy": 0.85,
  "total_sessions": 5,
  "total_questions": 40,
  "topic_breakdown": {
    "neural_networks": { "correct": 9, "total": 10, "accuracy": 0.9 },
    "optimization":    { "correct": 3, "total": 6,  "accuracy": 0.5 }
  },
  "weak_topics": ["optimization"],
  "feedback": "You are struggling with optimization. Revise before next session."
}
```

---

## 📊 Adaptive Difficulty Engine

```
╔══════════════════════════════════════════════════════╗
║              ADAPTIVE DIFFICULTY LOGIC               ║
╠══════════════════════════════════════════════════════╣
║                                                      ║
║   Current Score      →    Next Question Difficulty   ║
║   ─────────────────────────────────────────────────  ║
║   score < 0.40       →    🟢 EASY   (recall)         ║
║   0.40 ≤ score ≤ 0.70→    🟡 MEDIUM (explain)        ║
║   score > 0.70       →    🔴 HARD   (apply/analyze)  ║
║                                                      ║
║   Weak Topic Detection:                              ║
║   accuracy < 60% with ≥ 2 attempts = weak topic ⚠   ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
```

---

## 📁 Project Structure

```
Obsidian-Elite_edtech/
│
├── 🐍 backend/                         FastAPI Python backend
│   ├── api/
│   │   ├── main.py                     App entry, middleware, routers
│   │   └── routes/
│   │       ├── auth.py                 ✅ Login, signup, GitHub OAuth, JWT
│   │       ├── users.py                ✅ User CRUD (me, update, delete, list)
│   │       ├── transcription.py        ✅ Video processing + WebSocket live
│   │       └── performance.py          ✅ Scores, analytics, weak topics
│   ├── models/
│   │   ├── user.py                     User schema + UserCreateRequest
│   │   ├── session.py                  Session + answer models
│   │   └── question.py                 Question schema
│   ├── services/
│   │   ├── transcription.py            Whisper / Gemini transcription
│   │   ├── question_generation.py      Gemini question generation
│   │   ├── concept_extraction.py       spaCy + FAISS concept engine
│   │   ├── difficulty_engine.py        Adaptive difficulty logic
│   │   └── live_stream.py              Live audio buffer + quiz trigger
│   ├── workers/
│   │   └── celery_tasks.py             Async video processing tasks
│   ├── .env                            Local dev environment variables
│   ├── Dockerfile
│   └── requirements.txt
│
├── 💻 cli/                             Python CLI tool
│   ├── commands/
│   │   ├── process.py                  process command
│   │   ├── generate_test.py            test command
│   │   └── show_progress.py            progress command
│   └── main.py
│
├── 🔌 extension/                       Chrome browser extension
│   ├── src/
│   │   ├── background/background.ts    Service worker
│   │   ├── content/quiz_overlay.tsx    Quiz overlay injection
│   │   └── popup/Popup.tsx             Extension popup UI
│   └── manifest.json
│
├── 📚 docs/
│   ├── CLI_BACKEND_FRONTEND_GUIDE.md
│   ├── EXTENSION_DEVELOPER_GUIDE.md
│   └── STAGE_DEMO_RUNBOOK.md
│
├── docker-compose.yml                  Full stack orchestration
├── .env                                Root environment variables
└── README.md
```

---

## ⚙️ Tech Stack

```
╔══════════════════╦══════════════════════════════════════════════╗
║  Layer           ║  Technology                                  ║
╠══════════════════╬══════════════════════════════════════════════╣
║  Backend API     ║  FastAPI 0.111+, Python 3.11+, Uvicorn       ║
║  Database        ║  MongoDB 7.0 (Motor async driver)            ║
║  Cache / Queue   ║  Redis 7.0 + Celery 5.4                      ║
║  AI / NLP        ║  Google Gemini, spaCy, FAISS, transformers   ║
║  Auth            ║  JWT (python-jose), bcrypt, GitHub OAuth     ║
║  Browser Ext     ║  TypeScript, React, Webpack, Manifest V3     ║
║  CLI             ║  Click (Python)                              ║
║  DevOps          ║  Docker, Docker Compose                      ║
╚══════════════════╩══════════════════════════════════════════════╝
```

---

## 🛠️ Getting Started

### Prerequisites
- Docker Desktop installed and running
- Python 3.11+
- Node.js 18+ (for extension only)
- Google Gemini API key → [Get one here](https://makersuite.google.com/app/apikey)
- GitHub OAuth App → [Create here](https://github.com/settings/developers)

### 1. Clone & Configure

```bash
git clone https://github.com/Mr-BlackHat-lab/Obsidian-Elite_edtech.git
cd Obsidian-Elite_edtech
cp .env.example .env
```

Fill in your `.env`:

```env
GEMINI_API_KEY=your_gemini_api_key
JWT_SECRET=supersecretkey
JWT_ALGORITHM=HS256
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

### 2. Run with Docker (Recommended)

```bash
docker-compose up --build
```

```
✅ Backend API   →  http://localhost:8000
✅ MongoDB       →  localhost:27017
✅ Redis         →  localhost:6379
✅ Celery Worker →  background
```

### 3. Verify It's Running

```bash
curl http://localhost:8000/health
# → {"status": "ok", "service": "LearnPulse AI"}
```

### 4. Open API Docs

```
http://localhost:8000/docs     ← Swagger UI (interactive)
http://localhost:8000/redoc    ← ReDoc (readable)
```

### 5. CLI Usage

```bash
cd cli
pip install -r requirements.txt

# Process a YouTube video
python main.py process --url "https://www.youtube.com/watch?v=your_video"

# Take the generated quiz
python main.py test --session-id <session_id>

# View your performance
python main.py progress --user-id <user_id>

# Export results to JSON
python main.py test --session-id <session_id> --export-path results.json
```

### 6. Chrome Extension

```bash
cd extension
npm install
npm run build
```

1. Open `chrome://extensions/`
2. Enable **Developer Mode** (top right)
3. Click **Load unpacked**
4. Select the `extension/` folder
5. Open any YouTube video and start learning!

---

## 🌐 GitHub OAuth Setup

```
1. Go to → https://github.com/settings/developers
2. Click  → "New OAuth App"
3. Fill   → Homepage URL:  http://localhost:8000
            Callback URL:  http://localhost:8000/auth/github/callback
4. Copy   → Client ID and Client Secret into .env
```

---

## 🤝 Contributing

```bash
# 1. Create a new branch
git checkout -b feature/your-feature

# 2. Make your changes
# 3. Stage and commit
git add .
git commit -m "feat: your feature description"

# 4. Push — run from project ROOT not backend/
cd D:\Coding\Team\Obsidian-Elite_edtech
git push origin feature/your-feature
```

Then open a Pull Request on GitHub.

---

## 📄 License

TBD

---

<div align="center">

Built with ❤️ by **Obsidian Elite** — making learning active, not passive.

⭐ Star this repo if you find it useful!

</div>
