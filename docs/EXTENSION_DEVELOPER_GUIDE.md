# LearnPulse AI Extension Developer Guide

## 1. Purpose

This document explains how the LearnPulse Chrome extension is structured, how to run and use it, and how it integrates with backend services.

Primary audience:
- Backend developers implementing HTTP and WebSocket services for the extension
- CLI developers building local tools for testing, simulation, and automation

---

## 2. Current Scope in This Repository

Extension root:
- extension/

Main implementation files:
- extension/manifest.json
- extension/src/content/content_script.ts
- extension/src/content/quiz_overlay.tsx
- extension/src/background/background.ts
- extension/src/popup/Popup.tsx
- extension/src/popup/Dashboard.tsx
- extension/src/shared/types.ts
- extension/popup.html
- extension/src/popup/popup.html

Note:
- extension/popup.html is the file used by manifest action.default_popup.
- extension/src/popup/popup.html is the source template used during development and should stay in sync with extension/popup.html.

---

## 3. How To Run and Use the Extension

### 3.1 Install dependencies and build

From extension/:

```bash
npm install
npm run build
```

For active development:

```bash
npm run dev
```

### 3.2 Load in Chrome

1. Open chrome://extensions
2. Enable Developer mode
3. Click Load unpacked
4. Select the extension/ folder
5. Pin LearnPulse AI to the toolbar

### 3.3 Supported sites

Manifest currently injects content scripts on:
- YouTube watch pages
- Udemy course pages
- Coursera learn pages

### 3.4 Basic user flow

1. Open a supported video page and play video.
2. Extension creates/reuses a learning session.
3. At interval checkpoints, video is paused and a quiz overlay appears.
4. User submits answer, gets explanation, and continues video.
5. Popup shows live stats (accuracy, streak, weak topics).

---

## 4. Runtime Architecture

### 4.1 Components

- Content script
  - Detects video, manages checkpoint timing, renders quiz overlay, calls backend HTTP APIs
- Overlay UI
  - React modal in Shadow DOM, collects answer, calls submit-answer API
- Background service worker
  - Maintains badge state, owns live WebSocket and best-effort audio capture pipeline, relays quiz messages to active tab
- Popup UI
  - Dashboard, extension toggle, active-tab debug status

### 4.2 High-level flow

```text
Supported Video Tab (YouTube/Udemy/Coursera)
    -> content_script.ts detects video
    -> POST /transcribe (session bootstrap)
    -> periodic POST /generate-questions
    -> show overlay, POST /submit-answer
    -> update chrome.storage.local + badge

Background service worker (background.ts)
    -> reads extensionEnabled + sessionId from storage
    -> WebSocket connect to /ws/live-questions
    -> optional tab audio capture chunking
    -> relay SHOW_QUIZ messages to active tab
```

---

## 5. Backend Integration Contract

Base URLs hardcoded in extension:
- HTTP base: http://localhost:8000
- WebSocket: ws://localhost:8000/ws/live-questions

If backend URL changes, update:
- extension/src/content/content_script.ts (BACKEND_URL)
- extension/src/content/quiz_overlay.tsx (BACKEND_URL)
- extension/src/background/background.ts (BACKEND_WS_URL)

### 5.1 Question schema (required)

```json
{
  "question_id": "q_123",
  "question": "What does X do?",
  "type": "mcq",
  "difficulty": "easy",
  "options": ["A", "B", "C", "D"],
  "answer": "B",
  "explanation": "Because ...",
  "concept_tag": "docker"
}
```

Validation notes:
- type must be mcq or short_answer
- difficulty must be easy, medium, or hard
- options must always be an array

### 5.2 POST /transcribe

Used by content script to create or refresh a session for current video.

Request:

```json
{
  "video_url": "https://www.youtube.com/watch?v=...",
  "user_id": "user_001"
}
```

Response:

```json
{
  "session_id": "session_abc123"
}
```

### 5.3 POST /generate-questions

Used at checkpoint intervals to fetch a new question.

Request:

```json
{
  "transcript_chunk": "...",
  "session_id": "session_abc123"
}
```

Response:

```json
{
  "questions": [
    {
      "question_id": "q_1",
      "question": "...",
      "type": "mcq",
      "difficulty": "medium",
      "options": ["A", "B", "C", "D"],
      "answer": "B",
      "explanation": "...",
      "concept_tag": "kubernetes"
    }
  ]
}
```

### 5.4 POST /submit-answer

Used by overlay immediately after user submits.

Request:

```json
{
  "session_id": "session_abc123",
  "question_id": "q_1",
  "user_answer": "B",
  "concept_tag": "kubernetes"
}
```

Response:

```json
{
  "correct": true,
  "explanation": "...",
  "updated_score": 0.67,
  "weak_topics": ["docker networking"]
}
```

### 5.5 WebSocket /ws/live-questions

Connection pattern:
- Extension connects to:
  - ws://localhost:8000/ws/live-questions?session_id=<id>
- On open, extension sends:

```json
{
  "type": "hello",
  "session_id": "session_abc123",
  "source": "extension-background"
}
```

Audio chunks (best-effort) sent by extension:

```json
{
  "type": "audio_chunk",
  "session_id": "session_abc123",
  "audio_base64": "<base64 webm/opus chunk>"
}
```

Quiz messages expected from backend:
- Accepted format A:

```json
{
  "question": { "...": "question fields" },
  "session_id": "session_abc123"
}
```

- Accepted format B:

```json
{
  "data": {
    "question": { "...": "question fields" },
    "session_id": "session_abc123"
  }
}
```

When a valid question arrives, background relays:

```json
{
  "type": "SHOW_QUIZ",
  "question": { "...": "question fields" },
  "session_id": "session_abc123"
}
```

---

## 6. Background Service Worker Deep Dive

File:
- extension/src/background/background.ts

### 6.1 What it owns

- Badge updates (ON / percent / clear)
- Live socket lifecycle
- Reconnect strategy
- Audio capture pipeline
- Quiz relay to active tab

### 6.2 Lifecycle trigger points

Background sync is invoked on:
- extension install
- browser startup
- active tab activation/update
- storage changes to extensionEnabled or sessionId

### 6.3 Pipeline enable/disable conditions

Pipeline is active only when both are true:
- extensionEnabled is true (defaults to true if not set)
- sessionId exists in chrome.storage.local

If disabled or session missing:
- socket closes
- capture stops
- reconnect timers are cleared
- badge is set to idle (if disabled)

### 6.4 Reconnect logic

Exponential backoff is used:

- base = 1500 ms
- max = 12000 ms
- delay formula:
  - delay = min(base * 2^attempt, max)

Reconnect occurs only if the same session is still active.

### 6.5 Audio capture notes

Current implementation is best-effort using:
- chrome.tabCapture.capture({ audio: true, video: false })
- MediaRecorder with 2000 ms chunk interval

Important:
- In some Chrome MV3 environments, capture in service worker context may fail.
- If this happens, migrate capture logic to an offscreen document architecture.

---

## 7. Content Script and Quiz Behavior

File:
- extension/src/content/content_script.ts

Key behaviors:
- Detects first valid video element.
- Creates/reuses session per video URL.
- Uses DEMO_MODE = true currently:
  - checkpoint interval = 30 seconds
  - production interval = 300 seconds when DEMO_MODE is false
- Pauses and blurs page during quiz.
- Blocks common navigation keys while quiz is active.
- Resumes playback after answer feedback.

File:
- extension/src/content/quiz_overlay.tsx

Overlay behavior:
- Mounted in Shadow DOM to avoid host page CSS conflicts.
- Supports keyboard selection for MCQ (1..N).
- Submits answers to backend and shows explanation.

---

## 8. Popup and Debug Contract

Files:
- extension/src/popup/Popup.tsx
- extension/src/popup/Dashboard.tsx

Popup reads live stats from storage and sends a debug request to content script:

```json
{ "type": "GET_VIDEO_STATUS" }
```

Expected response from content script:

```json
{
  "extensionDetected": true,
  "videoFound": true,
  "videoPlaying": true,
  "extensionEnabled": true
}
```

Popup refreshes this debug status every ~2.5 seconds.

---

## 9. Storage Contract (chrome.storage.local)

Primary keys used:
- extensionEnabled: boolean
- sessionId: string
- sessionVideoUrl: string
- sessionScore: number (0.0 to 1.0)
- questionsAsked: number
- correctCount: number
- weakTopics: string[]
- streak: number
- transcript: string (optional fallback source)

Notes:
- extensionEnabled defaults to true when key is missing.
- session identity is reused when URL matches prior sessionVideoUrl.

---

## 10. CLI Developer Playbook

### 10.1 Test HTTP endpoints quickly

Create session:

```bash
curl -X POST http://localhost:8000/transcribe \
  -H "Content-Type: application/json" \
  -d '{"video_url":"https://www.youtube.com/watch?v=test","user_id":"user_001"}'
```

Generate question:

```bash
curl -X POST http://localhost:8000/generate-questions \
  -H "Content-Type: application/json" \
  -d '{"transcript_chunk":"intro to docker networks","session_id":"session_abc123"}'
```

Submit answer:

```bash
curl -X POST http://localhost:8000/submit-answer \
  -H "Content-Type: application/json" \
  -d '{"session_id":"session_abc123","question_id":"q_1","user_answer":"B","concept_tag":"docker"}'
```

### 10.2 Simulate WebSocket with Node CLI

Install:

```bash
npm i -g wscat
```

Connect:

```bash
wscat -c "ws://localhost:8000/ws/live-questions?session_id=session_abc123"
```

Send a live quiz event from backend side (example payload):

```json
{
  "question": {
    "question_id": "q_live_1",
    "question": "Which layer handles container networking?",
    "type": "mcq",
    "difficulty": "medium",
    "options": ["Kernel", "DNS only", "Browser", "GPU"],
    "answer": "Kernel",
    "explanation": "Container networking is implemented via kernel networking primitives.",
    "concept_tag": "containers"
  },
  "session_id": "session_abc123"
}
```

### 10.3 Recommended CLI automation checks

Build a small CLI script that verifies:
- /transcribe returns session_id
- /generate-questions returns at least one valid question
- /submit-answer returns updated_score in [0,1]
- WebSocket accepts hello and audio_chunk messages
- WebSocket can emit a valid quiz payload and extension displays overlay

---

## 11. Operational Troubleshooting

### Symptom: popup says Not detected

Check:
- active tab URL matches manifest rules
- extension has been reloaded after latest build
- dist/content_script.js exists and is current

### Symptom: no quiz appears even with active session

Check:
- backend /generate-questions response has questions[0]
- question schema fields are complete and correctly typed
- browser console logs from content script for fetch errors

### Symptom: live pipeline connected but no live overlay

Check:
- WebSocket payload uses accepted question envelope
- question validation passes schema checks in background
- active tab is the same window/tab targeted by relay

### Symptom: no audio chunks on backend

Check:
- tabCapture permission present (already in manifest)
- Chrome context supports tab capture + MediaRecorder in current runtime
- fallback plan: move capture to offscreen document

---

## 12. Recommended Next Improvements

- Move backend URLs to environment-based config at build time.
- Add explicit WebSocket message type for quiz events.
- Add backend ACK message for audio_chunk ingestion.
- Add a health endpoint and expose status in popup.
- Add a CLI integration test suite and run in CI.

---

## 13. Quick Reference

- Build extension: npm run build (inside extension/)
- Dev watch: npm run dev (inside extension/)
- Popup entry file used by Chrome: extension/popup.html
- Background runtime: extension/src/background/background.ts
- Content runtime: extension/src/content/content_script.ts
- Shared message types: extension/src/shared/types.ts
