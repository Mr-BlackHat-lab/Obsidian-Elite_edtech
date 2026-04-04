// ============================================================
// LearnPulse AI — content_script.ts
// Injected into YouTube, Udemy, Coursera pages.
// Handles: video detection, checkpoint timing, pause/blur,
//          question fetching, answer handling, live quiz relay.
// Stages covered: 1–6 (all checklist items)
// ============================================================

import type { Question, AnswerResult, ExtensionMessage } from "../shared/types";

const BACKEND_URL = "http://localhost:8000";
const QUIZ_INTERVAL_SECONDS = 300;

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
  status: string;
}

interface SessionResponse {
  status: string;
  transcript?: string;
  error?: string;
}

let lastQuizTime = 0;
let sessionId: string | null = null;
let quizActive = false;
let videoRef: HTMLVideoElement | null = null;
let extensionEnabled = true;
let initialized = false;
let demoMode = false;
let deviceUserId = "";

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

  const interval = demoMode ? 30 : QUIZ_INTERVAL_SECONDS;
  const elapsed = video.currentTime - lastQuizTime;

  // Debug logging
  if (Math.floor(video.currentTime) % 5 === 0 && video.currentTime > 0) {
    console.log(`[LP] Time: ${Math.floor(video.currentTime)}s, Elapsed: ${Math.floor(elapsed)}s, Interval: ${interval}s, Demo: ${demoMode}`);
  }

  // First quiz: wait for interval time (30s demo or 300s normal)
  // Subsequent quizzes: wait for interval time from last quiz
  if (elapsed >= interval) {
    console.log(`[LP] Checkpoint reached! Time: ${Math.floor(video.currentTime)}s, Triggering quiz...`);
    quizActive = true;
    pauseVideoStrict(video);

    try {
      // Get transcript chunk from current timestamp
      const question = await fetchQuestionForCurrentTime(sessionId, video.currentTime);
      if (!question) throw new Error("Empty question from backend");
      renderQuizOverlay(question, video);
    } catch (err) {
      console.error("[LP] Could not load question:", err);
      resumeVideoAuto(video);
      quizActive = false;
    }
  }
}

// ============================================================
// 4. PAUSE VIDEO (STRICT) — Video MUST pause, NO blur, Block keys
// ============================================================
function pauseVideoStrict(video: HTMLVideoElement): void {
  // STRICTLY pause video - mandatory
  video.pause();
  
  // DO NOT blur screen - keep clear view
  // DO NOT blur body
  
  // Block keyboard shortcuts during quiz
  window.addEventListener("keydown", blockNavigationKeys, true);
  
  console.log("[LP] Video PAUSED strictly. Keyboard shortcuts BLOCKED.");
}

function resumeVideoAuto(video: HTMLVideoElement): void {
  // AUTO-PLAY video after quiz
  video.play().catch(() => {
    console.warn("[LP] Autoplay blocked, user needs to click play.");
  });
  
  // Unblock keyboard shortcuts
  window.removeEventListener("keydown", blockNavigationKeys, true);
  
  lastQuizTime = video.currentTime;
  quizActive = false;
  
  console.log("[LP] Video AUTO-PLAYING. Keyboard shortcuts UNBLOCKED.");
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
// 5. FETCH QUESTION FROM BACKEND (FREE UNLIMITED API)
// ============================================================
<<<<<<< HEAD
async function fetchQuestionForCurrentTime(sid: string, currentTime: number): Promise<Question | null> {
  const stored = await chrome.storage.local.get(["transcript"]);
  const fullTranscript: string =
=======
async function fetchQuestion(sid: string): Promise<Question | null> {
  const stored = await chrome.storage.local.get(["transcript"]);
  const transcriptChunk: string =
>>>>>>> b34756bfd62230f4f9cbf47cc29669cde384a7f7
    typeof stored.transcript === "string" && stored.transcript
      ? stored.transcript
      : "Educational video content about programming and technology.";

  // Extract relevant chunk based on current video time
  // Improved: Use larger context window for better questions
  const wordsPerMinute = 150;
  const wordsPerSecond = wordsPerMinute / 60; // 2.5 words/second
  const estimatedWordPosition = Math.floor(currentTime * wordsPerSecond);
  
  const words = fullTranscript.split(/\s+/);
  
  // Use larger window: 100 words before and after current position
  const windowSize = 100;
  const startWord = Math.max(0, estimatedWordPosition - windowSize);
  const endWord = Math.min(words.length, estimatedWordPosition + windowSize);
  const transcriptChunk = words.slice(startWord, endWord).join(" ");

  // If chunk is too small, use more context
  let finalChunk = transcriptChunk;
  if (transcriptChunk.split(/\s+/).length < 50) {
    // Use first 200 words if we're early in the video
    if (currentTime < 60) {
      finalChunk = words.slice(0, 200).join(" ");
    } else {
      // Use larger window
      const largeStart = Math.max(0, estimatedWordPosition - 150);
      const largeEnd = Math.min(words.length, estimatedWordPosition + 150);
      finalChunk = words.slice(largeStart, largeEnd).join(" ");
    }
  }

  console.log(`[LP] Fetching question for time ${Math.floor(currentTime)}s from FREE API...`);
  console.log(`[LP] Transcript chunk (${finalChunk.split(/\s+/).length} words): "${finalChunk.substring(0, 150)}..."`);

  // Use FREE unlimited endpoint
  const response = await fetch(`${BACKEND_URL}/free-question`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transcript_chunk: finalChunk,
      session_id: sid,
      difficulty: "medium" // Will be auto-adjusted based on user score
    }),
  });

  if (!response.ok) {
    throw new Error(`free-question failed: ${response.status}`);
  }

  const data = await response.json();
  
  console.log(`[LP] Question generated in ${data.generation_time_ms}ms using FREE API`);
  console.log(`[LP] Model: ${data.model}`);
  console.log(`[LP] Difficulty: ${data.difficulty_used}`);
  console.log(`[LP] Question: "${data.question.question}"`);
  console.log(`[LP] Concept: ${data.question.concept_tag}`);
  
  return data.question ?? null;
}

// ============================================================
// 6. RENDER QUIZ OVERLAY — Direct import (no code splitting)
// ============================================================
import { mountQuizOverlay } from "./quiz_overlay";

function renderQuizOverlay(question: Question, video: HTMLVideoElement): void {
  if (!extensionEnabled) {
    resumeVideoAuto(video);
    quizActive = false;
    return;
  }

  const currentSessionId = sessionId;
  if (!currentSessionId) {
    console.warn("[LP] Missing session id while rendering quiz overlay.");
    resumeVideoAuto(video);
    quizActive = false;
    return;
  }

  try {
    mountQuizOverlay(question, currentSessionId, (result: AnswerResult) => {
      onAnswerSubmitted(result, video);
    });
  } catch (err) {
    console.error("[LP] Failed to load quiz overlay:", err);
    resumeVideoAuto(video);
    quizActive = false;
  }
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

  // Brief pause so user can absorb the explanation, then AUTO-PLAY video
  setTimeout(() => resumeVideoAuto(video), 1_500);
}

// ============================================================
// 8. SESSION MANAGEMENT — Create or reuse a backend session
// ============================================================
async function pollSessionReady(sid: string, maxWaitMs = 60_000): Promise<string | null> {
  const POLL_MS = 3_000;
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    try {
      const res = await fetch(`${BACKEND_URL}/session/${sid}`);
      if (!res.ok) continue;
      const data = (await res.json()) as SessionResponse;

      if (data.status === "failed") {
        console.warn("[LP] Session failed:", data.error ?? "no captions available");
        return null;
      }
      if (data.status === "ready") {
        if (data.transcript) {
          await chrome.storage.local.set({ transcript: data.transcript });
        }
        return sid;
      }
    } catch { /* network hiccup, keep polling */ }
  }
  console.warn("[LP] Session did not become ready within timeout.");
  return null;
}

async function getOrCreateSession(): Promise<string | null> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.sessionIdentity);
  const videoUrl = window.location.href;

  if (stored.sessionId && stored.sessionVideoUrl === videoUrl) {
    console.log("[LP] Reusing existing session:", stored.sessionId);
    return stored.sessionId as string;
  }

  try {
    const response = await fetch(`${BACKEND_URL}/transcribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_url: videoUrl, user_id: deviceUserId }),
    });

    if (!response.ok) throw new Error(`/transcribe failed: ${response.status}`);

    const data = (await response.json()) as TranscribeResponse;
    if (!data.session_id) throw new Error("/transcribe response missing session_id");

    const sid: string = data.session_id;

    await chrome.storage.local.set({
      sessionId: sid,
      sessionVideoUrl: videoUrl,
      sessionScore: 0,
      questionsAsked: 0,
      correctCount: 0,
      weakTopics: [],
      streak: 0,
      sessionStatus: "processing",
    });

    // If already ready (cache hit), skip polling
    if (data.status === "ready") {
      await chrome.storage.local.set({ sessionStatus: "ready" });
      return sid;
    }

    // Wait for Celery to finish processing
    const readySid = await pollSessionReady(sid);
    await chrome.storage.local.set({ sessionStatus: readySid ? "ready" : "failed" });
    return readySid;
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

  if (message.type === "RESET_SESSION") {
    console.log("[LP] Reset session requested");
    
    // Clear session state
    sessionId = null;
    initialized = false;
    quizActive = false;
    lastQuizTime = 0;
    
    // If video is paused by quiz, resume it
    if (videoRef && videoRef.paused) {
      videoRef.play().catch(() => {
        console.warn("[LP] Could not auto-play after reset");
      });
    }
    
    // Reinitialize if extension is enabled
    if (extensionEnabled) {
      console.log("[LP] Reinitializing after reset...");
      void init();
    }
    
    sendResponse({ success: true });
    return;
  }

  if (!extensionEnabled) return;

  if (message.type === "SHOW_QUIZ") {
    const video = videoRef ?? (document.querySelector("video") as HTMLVideoElement | null);
    if (video && !quizActive) {
      quizActive = true;
      sessionId = sessionId ?? message.session_id;
      pauseVideoStrict(video);
      renderQuizOverlay(message.question, video);
    }
  }
});

// ============================================================
// START
// ============================================================
async function bootstrap(): Promise<void> {
  console.debug("[LP][Debug] Content script injected on:", window.location.href);

  const settings = await chrome.storage.local.get([
    ...STORAGE_KEYS.extensionSettings,
    "deviceUserId",
    "demoMode",
  ]);
  extensionEnabled = isEnabledSetting(settings.extensionEnabled);
  demoMode = typeof settings.demoMode === "boolean" ? settings.demoMode : false;

  // Generate a persistent device-scoped user ID on first run
  if (typeof settings.deviceUserId === "string" && settings.deviceUserId) {
    deviceUserId = settings.deviceUserId;
  } else {
    deviceUserId = `device_${Math.random().toString(36).slice(2, 10)}`;
    await chrome.storage.local.set({ deviceUserId });
  }

  if (extensionEnabled) {
    await init();
  } else {
    updateBadge("IDLE");
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;

    if (changes.demoMode) {
      demoMode = typeof changes.demoMode.newValue === "boolean" ? changes.demoMode.newValue : false;
    }

    if (!changes.extensionEnabled) return;

    extensionEnabled = isEnabledSetting(changes.extensionEnabled.newValue);

    if (!extensionEnabled) {
      if (quizActive && videoRef) {
        resumeVideoAuto(videoRef);
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