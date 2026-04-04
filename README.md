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

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

### Extension Build

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
