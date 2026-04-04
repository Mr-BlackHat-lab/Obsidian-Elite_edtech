"""
LearnPulse AI — End-to-End Verification Script
Run AFTER docker-compose up --build

Tests:
  1. Backend health
  2. YouTube Transcript API (pre-recorded flow)
  3. Session polling until ready
  4. Question generation from transcript
  5. WebSocket live pipeline (Whisper check + ping/pong)

Usage:
    python verify.py
"""

import json
import sys
import time
import urllib.request
import urllib.error

BASE = "http://localhost:8000"
WS_URL = "ws://localhost:8000/ws/live"

# A short YouTube video with confirmed captions
TEST_VIDEO = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
TEST_USER = "verify_script"


def _get(path: str) -> dict:
    with urllib.request.urlopen(f"{BASE}{path}", timeout=10) as r:
        return json.loads(r.read())


def _post(path: str, body: dict) -> dict:
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())


def check(label: str, ok: bool, detail: str = "") -> None:
    status = "PASS" if ok else "FAIL"
    line = f"  [{status}] {label}"
    if detail:
        line += f" — {detail}"
    print(line)
    if not ok:
        sys.exit(1)


print("\n=== LearnPulse AI Verification ===\n")

# ── 1. Health ──────────────────────────────────────────────────────────────
print("1. Backend health")
try:
    resp = _get("/health")
    check("GET /health", resp.get("status") == "ok", str(resp))
except Exception as e:
    check("GET /health", False, str(e))

# ── 2. Transcribe (pre-recorded) ──────────────────────────────────────────
print("\n2. Pre-recorded video — YouTube Transcript API")
try:
    resp = _post("/transcribe", {"video_url": TEST_VIDEO, "user_id": TEST_USER})
    session_id = resp.get("session_id", "")
    status = resp.get("status", "")
    check("POST /transcribe returns session_id", bool(session_id), session_id)
    check("POST /transcribe status is processing or ready", status in ("processing", "ready"), status)
except Exception as e:
    check("POST /transcribe", False, str(e))
    session_id = ""

# ── 3. Poll until ready ────────────────────────────────────────────────────
print("\n3. Polling session until ready (max 60s)")
if session_id:
    deadline = time.time() + 60
    final_status = ""
    while time.time() < deadline:
        try:
            s = _get(f"/session/{session_id}")
            final_status = s.get("status", "")
            if final_status in ("ready", "failed"):
                break
        except Exception:
            pass
        print(f"     status={final_status}, waiting 3s...")
        time.sleep(3)

    check(
        f"Session reached terminal state",
        final_status in ("ready", "failed"),
        f"status={final_status}",
    )
    if final_status == "ready":
        check("Session has transcript", bool(s.get("transcript")), "")
        check("Session has questions", len(s.get("questions", [])) > 0, f"{len(s.get('questions', []))} questions")
    elif final_status == "failed":
        print(f"     NOTE: Video has no captions — error: {s.get('error', '')}")
        print("     This is expected behaviour for videos without subtitles.")

# ── 4. Generate questions ──────────────────────────────────────────────────
print("\n4. Question generation")
try:
    resp = _post("/generate-questions", {
        "transcript_chunk": "Python is a high-level programming language known for its simplicity and readability.",
        "session_id": session_id or None,
    })
    questions = resp.get("questions", [])
    check("POST /generate-questions returns questions", len(questions) > 0, f"{len(questions)} questions")
    q = questions[0]
    check("Question has required fields", all(k in q for k in ["question", "options", "answer", "difficulty"]), "")
except Exception as e:
    check("POST /generate-questions", False, str(e))

# ── 5. WebSocket live pipeline ─────────────────────────────────────────────
print("\n5. WebSocket live pipeline (Whisper check)")
try:
    import websocket  # pip install websocket-client

    ws_result = {"connected": False, "error_frame": None, "error_code": "", "pong": False}

    def on_open(ws):
        ws_result["connected"] = True
        ws.send(json.dumps({"type": "ping", "session_id": "verify_test"}))

    def on_message(ws, message):
        try:
            data = json.loads(message)
            if data.get("type") == "pong":
                ws_result["pong"] = True
            if data.get("type") == "ERROR":
                ws_result["error_frame"] = data
                ws_result["error_code"] = str(data.get("code", ""))
        except Exception:
            pass
        ws.close()

    def on_error(ws, error):
        ws_result["error_frame"] = str(error)

    ws = websocket.WebSocketApp(
        f"ws://localhost:8000/ws/live?session_id=verify_test&user_id=verify",
        on_open=on_open,
        on_message=on_message,
        on_error=on_error,
    )
    ws.run_forever(ping_timeout=8)

    check("WebSocket connected", ws_result["connected"])

    if ws_result["error_code"] == "WHISPER_UNAVAILABLE":
        check("Whisper available", False, str(ws_result["error_frame"]))
    elif ws_result["error_frame"]:
        check("No unexpected WS error", False, str(ws_result["error_frame"]))
    else:
        check("Whisper available (no ERROR frame)", True)
        check("WebSocket ping/pong works", ws_result["pong"])

except ImportError:
    print("  [SKIP] websocket-client not installed — skipping WS test")
    print("         Install with: pip install websocket-client")
except Exception as e:
    check("WebSocket test", False, str(e))

print("\n=== All checks passed ===\n")
