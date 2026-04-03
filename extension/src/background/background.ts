// ============================================================
// LearnPulse AI — background.ts
// Background service worker:
// 1) Live pipeline (best-effort tab audio capture + WebSocket)
// 2) Quiz relay to active tab
// 3) Extension badge state management
// ============================================================

import type { ExtensionMessage, Question } from "../shared/types";

const BACKEND_WS_URL = "ws://localhost:8000/ws/live";
const AUDIO_CHUNK_MS = 5_000;
const HEARTBEAT_MS = 30_000;
const RECONNECT_BASE_MS = 1_500;
const RECONNECT_MAX_MS = 12_000;

let liveSocket: WebSocket | null = null;
let socketSessionId: string | null = null;
let reconnectAttempt = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

let captureStream: MediaStream | null = null;
let mediaRecorder: MediaRecorder | null = null;
let captureSessionId: string | null = null;
let captureAttemptedSessionId: string | null = null;

function isExtensionEnabled(value: unknown): boolean {
  return typeof value === "boolean" ? value : true;
}

function isQuestion(value: unknown): value is Question {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<Question>;

  return (
    typeof candidate.question_id === "string" &&
    typeof candidate.question === "string" &&
    (candidate.type === "mcq" || candidate.type === "short_answer") &&
    (candidate.difficulty === "easy" ||
      candidate.difficulty === "medium" ||
      candidate.difficulty === "hard") &&
    Array.isArray(candidate.options) &&
    typeof candidate.answer === "string" &&
    typeof candidate.explanation === "string" &&
    typeof candidate.concept_tag === "string"
  );
}

function clearReconnectTimer(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function clearHeartbeatTimer(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function closeSocket(): void {
  if (!liveSocket) return;

  liveSocket.onopen = null;
  liveSocket.onmessage = null;
  liveSocket.onerror = null;
  liveSocket.onclose = null;
  liveSocket.close();
  liveSocket = null;
  clearHeartbeatTimer();
}

function stopAudioCapture(): void {
  if (mediaRecorder) {
    if (mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    mediaRecorder.ondataavailable = null;
    mediaRecorder.onerror = null;
    mediaRecorder = null;
  }

  if (captureStream) {
    captureStream.getTracks().forEach((track) => track.stop());
    captureStream = null;
  }

  captureSessionId = null;
}

async function stopLivePipeline(): Promise<void> {
  clearReconnectTimer();
  clearHeartbeatTimer();
  closeSocket();
  stopAudioCapture();
  socketSessionId = null;
  reconnectAttempt = 0;
  captureAttemptedSessionId = null;
}

async function sendAudioChunk(blob: Blob): Promise<void> {
  if (!liveSocket || liveSocket.readyState !== WebSocket.OPEN) return;

  try {
    liveSocket.send(blob);
  } catch (err) {
    console.warn("[LP BG] Failed to forward audio chunk:", err);
  }
}

async function ensureAudioCapture(sessionId: string): Promise<void> {
  if (captureSessionId === sessionId && mediaRecorder?.state === "recording")
    return;
  if (captureAttemptedSessionId === sessionId) return;

  captureAttemptedSessionId = sessionId;

  if (!chrome.tabCapture?.capture) {
    console.warn("[LP BG] tabCapture.capture unavailable in this runtime.");
    return;
  }

  if (typeof MediaRecorder === "undefined") {
    console.warn(
      "[LP BG] MediaRecorder unavailable in service worker context.",
    );
    return;
  }

  chrome.tabCapture.capture(
    { audio: true, video: false },
    (stream: MediaStream | null) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError || !stream) {
        console.warn(
          "[LP BG] Audio capture not started:",
          runtimeError?.message,
        );
        return;
      }

      try {
        stopAudioCapture();
        captureStream = stream;
        captureSessionId = sessionId;

        const recorder = new MediaRecorder(stream, {
          mimeType: "audio/webm;codecs=opus",
        });

        recorder.ondataavailable = (event: BlobEvent) => {
          if (!event.data || event.data.size === 0) return;
          void sendAudioChunk(event.data);
        };

        recorder.onerror = (event) => {
          console.warn("[LP BG] MediaRecorder error:", event);
        };

        recorder.start(AUDIO_CHUNK_MS);
        mediaRecorder = recorder;

        console.info("[LP BG] Audio capture started.");
      } catch (err) {
        console.warn("[LP BG] Failed to initialize audio recorder:", err);
        stopAudioCapture();
      }
    },
  );
}

function parseShowQuizMessage(
  rawData: unknown,
  fallbackSessionId: string,
): ExtensionMessage | null {
  if (typeof rawData !== "string") return null;

  try {
    const payload = JSON.parse(rawData) as {
      type?: string;
      question?: unknown;
      session_id?: unknown;
      data?: { question?: unknown; session_id?: unknown };
    };

    const questionCandidate = payload.question ?? payload.data?.question;
    const sessionCandidate =
      typeof payload.session_id === "string"
        ? payload.session_id
        : typeof payload.data?.session_id === "string"
          ? payload.data.session_id
          : fallbackSessionId;

    if (!isQuestion(questionCandidate)) return null;

    return {
      type: "SHOW_QUIZ",
      question: questionCandidate,
      session_id: sessionCandidate,
    };
  } catch {
    return null;
  }
}

function scheduleReconnect(sessionId: string, videoUrl: string): void {
  clearReconnectTimer();

  const delay = Math.min(
    RECONNECT_BASE_MS * Math.max(1, 2 ** reconnectAttempt),
    RECONNECT_MAX_MS,
  );

  reconnectAttempt += 1;

  reconnectTimer = setTimeout(() => {
    void connectWebSocket(sessionId, videoUrl);
  }, delay);
}

async function connectWebSocket(sessionId: string, videoUrl: string = ""): Promise<void> {
  if (
    liveSocket &&
    (liveSocket.readyState === WebSocket.OPEN ||
      liveSocket.readyState === WebSocket.CONNECTING) &&
    socketSessionId === sessionId
  ) {
    return;
  }

  clearReconnectTimer();
  closeSocket();
  socketSessionId = sessionId;

  const wsUrl = `${BACKEND_WS_URL}?session_id=${encodeURIComponent(sessionId)}&user_id=${encodeURIComponent("anonymous")}${videoUrl ? `&video_url=${encodeURIComponent(videoUrl)}` : ""}`;
  const socket = new WebSocket(wsUrl);
  liveSocket = socket;

  socket.onopen = () => {
    reconnectAttempt = 0;

    socket.send(JSON.stringify({ type: "hello", session_id: sessionId }));

    clearHeartbeatTimer();
    heartbeatTimer = setInterval(() => {
      if (socket.readyState !== WebSocket.OPEN) return;
      socket.send(JSON.stringify({ type: "ping", session_id: sessionId }));
    }, HEARTBEAT_MS);

    console.info("[LP BG] Live socket connected.");
  };

  socket.onmessage = (event) => {
    const relayMessage = parseShowQuizMessage(event.data, sessionId);
    if (relayMessage && relayMessage.type === "SHOW_QUIZ") {
      console.info("[LP BG] Live quiz received. Relaying to active tab.");
      void relayQuizToActiveTab(relayMessage);
      return;
    }

    // Handle server-sent error frames
    try {
      const payload = JSON.parse(event.data as string) as { type?: string; message?: string };
      if (payload.type === "ERROR") {
        console.error("[LP BG] Server error:", payload.message);
      }
    } catch { /* not JSON */ }
  };

  socket.onerror = (event) => {
    console.warn("[LP BG] Live socket error:", event);
  };

  socket.onclose = () => {
    clearHeartbeatTimer();
    if (liveSocket === socket) {
      liveSocket = null;
      if (socketSessionId === sessionId) {
        scheduleReconnect(sessionId, videoUrl);
      }
    }
  };
}

async function syncLivePipeline(): Promise<void> {
  const stored = await chrome.storage.local.get([
    "extensionEnabled",
    "sessionId",
    "sessionScore",
    "sessionVideoUrl",
  ]);

  const enabled = isExtensionEnabled(stored.extensionEnabled);
  const sessionId =
    typeof stored.sessionId === "string" ? stored.sessionId : null;
  const videoUrl =
    typeof stored.sessionVideoUrl === "string" ? stored.sessionVideoUrl : "";

  if (!enabled || !sessionId) {
    await stopLivePipeline();
    if (!enabled) {
      handleBadgeUpdate("IDLE");
    }
    return;
  }

  const scorePercent =
    typeof stored.sessionScore === "number"
      ? Math.round(stored.sessionScore * 100)
      : undefined;

  handleBadgeUpdate("ACTIVE", scorePercent);
  await connectWebSocket(sessionId, videoUrl);
  await ensureAudioCapture(sessionId);
}

/**
 * Listen for messages from content scripts.
 *
 * Currently handles:
 *   UPDATE_BADGE — sent by content_script.ts after session init or score update
 */
chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, _sendResponse) => {
    if (message.type === "UPDATE_BADGE") {
      handleBadgeUpdate(message.status, message.scorePercent);
    }
    // Future: add relay logic for other message types here
  },
);

/**
 * Update the extension action badge based on session state.
 *
 * - ACTIVE with a score:  shows "74%" in indigo
 * - ACTIVE without score: shows "ON"  in indigo
 * - IDLE:                 clears the badge
 */
function handleBadgeUpdate(
  status: "ACTIVE" | "IDLE",
  scorePercent?: number,
): void {
  if (status === "ACTIVE") {
    const text =
      scorePercent !== undefined && scorePercent > 0
        ? `${scorePercent}%`
        : "ON";

    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color: "#6366f1" });
    chrome.action.setBadgeTextColor({ color: "#ffffff" });
  } else {
    chrome.action.setBadgeText({ text: "" });
  }
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;

  if (changes.extensionEnabled) {
    const enabled = isExtensionEnabled(changes.extensionEnabled.newValue);
    if (!enabled) {
      handleBadgeUpdate("IDLE");
    }
  }

  if (changes.extensionEnabled || changes.sessionId) {
    void syncLivePipeline();
    return;
  }

  if (changes.sessionScore) {
    chrome.storage.local.get(["sessionId", "sessionScore"], (stored) => {
      if (!stored.sessionId) return;

      const scorePercent = stored.sessionScore
        ? Math.round((stored.sessionScore as number) * 100)
        : undefined;

      handleBadgeUpdate("ACTIVE", scorePercent);
    });
  }
});

/**
 * Relay quiz questions from the background (T2) to the active tab's content
 * script.  T2 calls this helper after receiving a live question over WebSocket.
 *
 * Usage (by T2, inside their WebSocket message handler):
 *   relayQuizToActiveTab({ type: "SHOW_QUIZ", question, session_id });
 */
export async function relayQuizToActiveTab(
  message: ExtensionMessage,
): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) {
      console.warn("[LP BG] No active tab found — cannot relay quiz.");
      return;
    }
    await chrome.tabs.sendMessage(tab.id, message);
  } catch (err) {
    console.error("[LP BG] Failed to relay quiz to tab:", err);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void syncLivePipeline();
});

chrome.tabs.onActivated.addListener(() => {
  void syncLivePipeline();
});

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;
  if (!tab.active) return;
  void syncLivePipeline();
});

/**
 * On service worker startup, restore the badge if a session was already active.
 * (Service workers can be killed and restarted by Chrome at any time.)
 */
chrome.runtime.onStartup.addListener(async () => {
  await syncLivePipeline();
});

void syncLivePipeline();
