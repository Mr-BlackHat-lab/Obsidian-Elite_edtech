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
let checkpointTimer: ReturnType<typeof setInterval> | null = null;
let initRetryTimer: ReturnType<typeof setTimeout> | null = null;
let demoQuestionIndex = 0;

const DEMO_VIDEO_ID = "ZzI9JE0i6Lc";

const DEMO_QUESTIONS: Question[] = [
  {
    question_id: "demo-zzi9-1",
    question: "What is the main purpose of a Docker volume?",
    type: "mcq",
    difficulty: "easy",
    options: [
      "To speed up image downloads",
      "To persist data outside the container lifecycle",
      "To replace the container runtime",
      "To encrypt network traffic",
    ],
    answer: "To persist data outside the container lifecycle",
    explanation:
      "Volumes keep data even when the container is recreated or deleted.",
    concept_tag: "Docker fundamentals",
  },
  {
    question_id: "demo-zzi9-2",
    question: "Which statement best describes Kubernetes?",
    type: "mcq",
    difficulty: "medium",
    options: [
      "A tool for editing code",
      "A container orchestration platform",
      "A video streaming protocol",
      "A password hashing library",
    ],
    answer: "A container orchestration platform",
    explanation:
      "Kubernetes manages and scales containerized workloads across machines.",
    concept_tag: "Kubernetes basics",
  },
  {
    question_id: "demo-zzi9-3",
    question:
      "Name one reason to use a CI pipeline in modern software delivery.",
    type: "short_answer",
    difficulty: "hard",
    options: [],
    answer: "automate testing and deployment",
    explanation:
      "CI pipelines automate testing/builds so changes can be verified quickly and reliably.",
    concept_tag: "DevOps workflow",
  },
];

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

  if (initRetryTimer) {
    clearTimeout(initRetryTimer);
    initRetryTimer = null;
  }

  console.log("[LP] Initializing LearnPulse AI...");

  const video = await waitForVideo();
  if (!video) {
    console.warn("[LP] No video found within timeout, giving up.");
    initRetryTimer = setTimeout(() => {
      if (!initialized && extensionEnabled) {
        void init();
      }
    }, 10_000);
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
  video.addEventListener("timeupdate", () => handleTimeUpdate(video), {
    passive: true,
  });
  if (checkpointTimer) {
    clearInterval(checkpointTimer);
  }
  checkpointTimer = setInterval(() => {
    void handleTimeUpdate(video);
  }, 1_000);

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
  const currentVideoUrl = video.currentSrc || video.src || window.location.href;

  // Require video to have been playing for at least 10 seconds before first quiz
  if (elapsed >= interval && video.currentTime > 10) {
    console.debug("[LP] Checkpoint reached", {
      sessionId,
      demoMode,
      currentTime: Math.round(video.currentTime),
      elapsed: Math.round(elapsed),
      interval,
    });
    quizActive = true;
    pauseAndBlur(video);

    try {
      const question = demoMode
        ? getDemoFallbackQuestion(currentVideoUrl)
        : await fetchQuestion(sessionId);
      if (!question) throw new Error("Empty question from backend");
      renderQuizOverlay(question, video);
    } catch (err) {
      console.error("[LP] Could not load question:", err);

      const fallback = getDemoFallbackQuestion(currentVideoUrl);
      if (fallback) {
        console.warn("[LP] Using local demo fallback question.");
        renderQuizOverlay(fallback, video);
        return;
      }

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

  if (
    BLOCKED_NAVIGATION_KEYS.has(e.code) ||
    BLOCKED_NAVIGATION_KEYS.has(e.key)
  ) {
    e.preventDefault();
    e.stopImmediatePropagation();
  }
}

// ============================================================
// 5. FETCH QUESTION FROM BACKEND
// ============================================================
async function fetchQuestion(sid: string): Promise<Question | null> {
  console.debug("[LP] Fetching question from backend", {
    sessionId: sid,
    endpoint: `${BACKEND_URL}/generate-questions`,
  });

  const stored = await chrome.storage.local.get(["transcript"]);
  const transcriptChunk: string =
    typeof stored.transcript === "string" && stored.transcript
      ? stored.transcript
      : "Educational video content about programming and technology.";

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

function getVideoId(urlValue: string): string {
  try {
    const parsed = new URL(urlValue);
    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.replace("/", "").trim();
    }

    return parsed.searchParams.get("v")?.trim() ?? "";
  } catch {
    return "";
  }
}

function isDemoVideoUrl(urlValue: string): boolean {
  return getVideoId(urlValue) === DEMO_VIDEO_ID;
}

function getDemoFallbackQuestion(urlValue: string): Question | null {
  if (!demoMode || !isDemoVideoUrl(urlValue)) return null;

  const question = DEMO_QUESTIONS[demoQuestionIndex] ?? null;
  if (!question) return null;

  demoQuestionIndex = Math.min(demoQuestionIndex + 1, DEMO_QUESTIONS.length);
  void chrome.storage.local.set({ demoQuestionIndex });
  console.debug("[LP] Demo question selected:", question.question_id);
  return question;
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
async function onAnswerSubmitted(
  result: AnswerResult,
  video: HTMLVideoElement,
): Promise<void> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.sessionStats);

  const questionsAsked: number = (stored.questionsAsked ?? 0) + 1;
  const correctCount: number =
    (stored.correctCount ?? 0) + (result.correct ? 1 : 0);

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
async function pollSessionReady(
  sid: string,
  maxWaitMs = 60_000,
): Promise<string | null> {
  const POLL_MS = 3_000;
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    try {
      const res = await fetch(`${BACKEND_URL}/session/${sid}`);
      if (!res.ok) continue;
      const data = (await res.json()) as SessionResponse;

      if (data.status === "failed") {
        console.warn(
          "[LP] Session failed:",
          data.error ?? "no captions available",
        );
        return null;
      }
      if (data.status === "ready") {
        if (data.transcript) {
          await chrome.storage.local.set({ transcript: data.transcript });
        }
        return sid;
      }
    } catch {
      /* network hiccup, keep polling */
    }
  }
  console.warn("[LP] Session did not become ready within timeout.");
  return null;
}

async function getOrCreateSession(): Promise<string | null> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.sessionIdentity);
  const videoUrl = window.location.href;

  if (isDemoVideoUrl(videoUrl) && stored.sessionVideoUrl !== videoUrl) {
    demoQuestionIndex = 0;
    await chrome.storage.local.set({ demoQuestionIndex: 0 });
  }

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
    if (!data.session_id)
      throw new Error("/transcribe response missing session_id");

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
    await chrome.storage.local.set({
      sessionStatus: readySid ? "ready" : "failed",
    });
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
chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse) => {
    if (message.type === "GET_VIDEO_STATUS") {
      const currentVideo =
        videoRef ?? document.querySelector<HTMLVideoElement>("video");
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
      const video =
        videoRef ??
        (document.querySelector("video") as HTMLVideoElement | null);
      if (video && !quizActive) {
        quizActive = true;
        sessionId = sessionId ?? message.session_id;
        pauseAndBlur(video);
        renderQuizOverlay(message.question, video);
      }
    }
  },
);

// ============================================================
// START
// ============================================================
async function bootstrap(): Promise<void> {
  console.debug(
    "[LP][Debug] Content script injected on:",
    window.location.href,
  );

  const settings = await chrome.storage.local.get([
    ...STORAGE_KEYS.extensionSettings,
    "deviceUserId",
    "demoMode",
    "demoQuestionIndex",
  ]);
  extensionEnabled = isEnabledSetting(settings.extensionEnabled);
  demoMode = typeof settings.demoMode === "boolean" ? settings.demoMode : false;
  demoQuestionIndex =
    typeof settings.demoQuestionIndex === "number"
      ? settings.demoQuestionIndex
      : 0;

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
      demoMode =
        typeof changes.demoMode.newValue === "boolean"
          ? changes.demoMode.newValue
          : false;
    }

    if (!changes.extensionEnabled) return;

    extensionEnabled = isEnabledSetting(changes.extensionEnabled.newValue);

    if (!extensionEnabled) {
      if (quizActive && videoRef) {
        resumeVideo(videoRef);
      }
      if (checkpointTimer) {
        clearInterval(checkpointTimer);
        checkpointTimer = null;
      }
      if (initRetryTimer) {
        clearTimeout(initRetryTimer);
        initRetryTimer = null;
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
