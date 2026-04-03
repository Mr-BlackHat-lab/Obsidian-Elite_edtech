// ============================================================
// LearnPulse AI — content_script.ts
// Injected into YouTube, Udemy, Coursera pages.
// Handles: video detection, checkpoint timing, pause/blur,
//          question fetching, answer handling, live quiz relay.
// Stages covered: 1–6 (all checklist items)
// ============================================================

import type { Question, AnswerResult, ExtensionMessage } from "../shared/types";

const BACKEND_URL = "http://localhost:8000";
const QUIZ_INTERVAL_SECONDS = 300;  // 5 minutes in production
const DEMO_MODE = true;             // ← SET TO FALSE FOR PRODUCTION (uses 5-min timer)

const STORAGE_KEYS = {
  transcript: ["transcript"],
  sessionStats: ["questionsAsked", "correctCount", "streak"],
  sessionIdentity: ["sessionId", "sessionVideoUrl"],
  extensionSettings: ["extensionEnabled"],
} as const;

const BLOCKED_NAVIGATION_KEYS = new Set([
  "Escape",
  "ArrowLeft",
  "ArrowRight",
  "KeyL",
  "KeyJ",
  "Space",
  "KeyF",
]);

interface GenerateQuestionsResponse {
  questions?: Question[];
}

interface TranscribeResponse {
  session_id: string;
}

let lastQuizTime = 0;
let sessionId: string | null = null;
let quizActive = false;
let videoRef: HTMLVideoElement | null = null;
let extensionEnabled = true;
let initialized = false;

function isEnabledSetting(value: unknown): boolean {
  return typeof value === "boolean" ? value : true;
}

interface VideoStatusResponse {
  extensionDetected: boolean;
  videoFound: boolean;
  videoPlaying: boolean;
  extensionEnabled: boolean;
}

// ============================================================
// 1. INITIALIZATION — Run when page loads
// ============================================================
async function init(): Promise<void> {
  if (initialized || !extensionEnabled) return;

  console.log("[LP] Initializing LearnPulse AI...");

  const video = await waitForVideo();
  if (!video) {
    console.warn("[LP] No video found within timeout, giving up.");
    return;
  }

  videoRef = video;
  console.log("[LP] Video detected, creating session...");

  sessionId = await getOrCreateSession();
  if (!sessionId) {
    console.error("[LP] Could not create session. Backend may be offline.");
    return;
  }

  console.log("[LP] Session ready:", sessionId);

  // Start monitoring playback
  video.addEventListener("timeupdate", () => handleTimeUpdate(video), { passive: true });

  // Notify extension badge
  updateBadge("ACTIVE");
  initialized = true;
}

// ============================================================
// 2. VIDEO DETECTION — Poll until a playing video is found
// ============================================================
function waitForVideo(): Promise<HTMLVideoElement | null> {
  return new Promise((resolve) => {
    const POLL_MS = 500;
    const TIMEOUT_MS = 15_000;
    const started = Date.now();

    const check = (): void => {
      const video = document.querySelector<HTMLVideoElement>("video");
      if (video && video.readyState >= 1 && video.duration > 0) {
        resolve(video);
        return;
      }
      if (Date.now() - started >= TIMEOUT_MS) {
        resolve(null);
        return;
      }
      setTimeout(check, POLL_MS);
    };

    check();
  });
}

// ============================================================
// 3. CHECKPOINT LOGIC — Fires every timeupdate event
// ============================================================
async function handleTimeUpdate(video: HTMLVideoElement): Promise<void> {
  if (!extensionEnabled || quizActive || !sessionId) return;

  const interval = DEMO_MODE ? 30 : QUIZ_INTERVAL_SECONDS;
  const elapsed = video.currentTime - lastQuizTime;

  // Require video to have been playing for at least 10 seconds before first quiz
  if (elapsed >= interval && video.currentTime > 10) {
    quizActive = true;
    pauseAndBlur(video);

    try {
      const question = await fetchQuestion(sessionId);
      if (!question) throw new Error("Empty question from backend");
      renderQuizOverlay(question, video);
    } catch (err) {
      console.error("[LP] Could not load question:", err);
      resumeVideo(video);
      quizActive = false;
    }
  }
}

// ============================================================
// 4. PAUSE & BLUR — Lock the page during quiz
// ============================================================
function pauseAndBlur(video: HTMLVideoElement): void {
  video.pause();

  // Apply blur to body, but NOT to the overlay container
  document.body.style.filter = "blur(6px)";
  document.body.style.pointerEvents = "none";
  document.body.style.userSelect = "none";
  document.body.style.transition = "filter 0.3s ease";

  // Block Escape and all navigation shortcuts
  window.addEventListener("keydown", blockNavigationKeys, true);
}

function resumeVideo(video: HTMLVideoElement): void {
  video.play().catch(() => {
    // Autoplay might be blocked — user can click play
    console.warn("[LP] Autoplay blocked after quiz.");
  });

  document.body.style.filter = "";
  document.body.style.pointerEvents = "";
  document.body.style.userSelect = "";
  document.body.style.transition = "";

  window.removeEventListener("keydown", blockNavigationKeys, true);

  lastQuizTime = video.currentTime;
  quizActive = false;
}

/** Blocks Escape and common keyboard shortcuts while quiz is active */
function blockNavigationKeys(e: KeyboardEvent): void {
  // Allow number keys 1–4 for MCQ selection (handled in overlay)
  if (e.key >= "1" && e.key <= "4") return;

  if (BLOCKED_NAVIGATION_KEYS.has(e.code) || BLOCKED_NAVIGATION_KEYS.has(e.key)) {
    e.preventDefault();
    e.stopImmediatePropagation();
  }
}

// ============================================================
// 5. FETCH QUESTION FROM BACKEND
// ============================================================
async function fetchQuestion(sid: string): Promise<Question | null> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.transcript);
  const transcriptChunk: string =
    stored.transcript ?? "Educational video content about programming and technology.";

  const response = await fetch(`${BACKEND_URL}/generate-questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transcript_chunk: transcriptChunk,
      session_id: sid,
    }),
  });

  if (!response.ok) {
    throw new Error(`generate-questions failed: ${response.status}`);
  }

  const data = (await response.json()) as GenerateQuestionsResponse;
  const question: Question | undefined = data.questions?.[0];
  return question ?? null;
}

// ============================================================
// 6. RENDER QUIZ OVERLAY — Dynamic import to keep bundle lean
// ============================================================
function renderQuizOverlay(question: Question, video: HTMLVideoElement): void {
  if (!extensionEnabled) {
    resumeVideo(video);
    quizActive = false;
    return;
  }

  const currentSessionId = sessionId;
  if (!currentSessionId) {
    console.warn("[LP] Missing session id while rendering quiz overlay.");
    resumeVideo(video);
    quizActive = false;
    return;
  }

  // @ts-ignore -- dynamic import resolves correctly in both webpack and tsc
  import("./quiz_overlay")
    .then(({ mountQuizOverlay }) => {
      mountQuizOverlay(question, currentSessionId, (result: AnswerResult) => {
        onAnswerSubmitted(result, video);
      });
    })
    .catch((err) => {
      console.error("[LP] Failed to load quiz overlay module:", err);
      resumeVideo(video);
      quizActive = false;
    });
}

// ============================================================
// 7. HANDLE ANSWER SUBMISSION — Update storage & streak
// ============================================================
async function onAnswerSubmitted(result: AnswerResult, video: HTMLVideoElement): Promise<void> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.sessionStats);

  const questionsAsked: number = (stored.questionsAsked ?? 0) + 1;
  const correctCount: number = (stored.correctCount ?? 0) + (result.correct ? 1 : 0);

  // Streak: increment if correct, reset to 0 if wrong
  const prevStreak: number = stored.streak ?? 0;
  const streak: number = result.correct ? prevStreak + 1 : 0;

  // Score badge update (0.0–1.0 → percentage string)
  const scorePercent = Math.round(result.updated_score * 100);
  updateBadge("ACTIVE", scorePercent);

  await chrome.storage.local.set({
    sessionScore: result.updated_score,
    questionsAsked,
    correctCount,
    weakTopics: result.weak_topics,
    streak,
  });

  // Brief pause so user can absorb the explanation, then resume
  setTimeout(() => resumeVideo(video), 1_500);
}

// ============================================================
// 8. SESSION MANAGEMENT — Create or reuse a backend session
// ============================================================
async function getOrCreateSession(): Promise<string | null> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.sessionIdentity);
  const videoUrl = window.location.href;

  // Reuse existing session if navigating back to the same video
  if (stored.sessionId && stored.sessionVideoUrl === videoUrl) {
    console.log("[LP] Reusing existing session:", stored.sessionId);
    return stored.sessionId as string;
  }

  // New video — create a fresh session
  try {
    const response = await fetch(`${BACKEND_URL}/transcribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_url: videoUrl, user_id: "user_001" }),
    });

    if (!response.ok) throw new Error(`/transcribe failed: ${response.status}`);

    const data = (await response.json()) as TranscribeResponse;
    if (!data.session_id) {
      throw new Error("/transcribe response missing session_id");
    }

    const sid: string = data.session_id;

    await chrome.storage.local.set({
      sessionId: sid,
      sessionVideoUrl: videoUrl,
      sessionScore: 0,
      questionsAsked: 0,
      correctCount: 0,
      weakTopics: [],
      streak: 0,
    });

    return sid;
  } catch (err) {
    console.error("[LP] Session creation error:", err);
    return null;
  }
}

// ============================================================
// 9. BADGE HELPER — Communicates with background.ts
// ============================================================
function updateBadge(status: "ACTIVE" | "IDLE", scorePercent?: number): void {
  const message: ExtensionMessage =
    scorePercent !== undefined
      ? { type: "UPDATE_BADGE", status, scorePercent }
      : { type: "UPDATE_BADGE", status };

  void chrome.runtime.sendMessage(message).catch(() => {
    // Background service worker may have been restarted — ignore
  });
}

// ============================================================
// 10. RECEIVE LIVE QUESTIONS FROM T2 BACKGROUND SCRIPT
// ============================================================
chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type === "GET_VIDEO_STATUS") {
    const currentVideo = videoRef ?? document.querySelector<HTMLVideoElement>("video");
    const isPlaying =
      !!currentVideo &&
      !currentVideo.paused &&
      !currentVideo.ended &&
      currentVideo.readyState >= 2;

    const response: VideoStatusResponse = {
      extensionDetected: true,
      videoFound: !!currentVideo,
      videoPlaying: isPlaying,
      extensionEnabled,
    };

    console.debug("[LP][Debug] Popup requested video status:", response);
    sendResponse(response);
    return;
  }

  if (!extensionEnabled) return;

  if (message.type === "SHOW_QUIZ") {
    const video = videoRef ?? (document.querySelector("video") as HTMLVideoElement | null);
    if (video && !quizActive) {
      quizActive = true;
      sessionId = sessionId ?? message.session_id;
      pauseAndBlur(video);
      renderQuizOverlay(message.question, video);
    }
  }
});

// ============================================================
// START
// ============================================================
async function bootstrap(): Promise<void> {
  console.debug("[LP][Debug] Content script injected on:", window.location.href);

  const settings = await chrome.storage.local.get(STORAGE_KEYS.extensionSettings);
  extensionEnabled = isEnabledSetting(settings.extensionEnabled);

  if (extensionEnabled) {
    await init();
  } else {
    updateBadge("IDLE");
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes.extensionEnabled) return;

    extensionEnabled = isEnabledSetting(changes.extensionEnabled.newValue);

    if (!extensionEnabled) {
      if (quizActive && videoRef) {
        resumeVideo(videoRef);
      }
      updateBadge("IDLE");
      return;
    }

    if (!initialized) {
      void init();
      return;
    }

    if (sessionId) {
      updateBadge("ACTIVE");
    }
  });
}

void bootstrap();