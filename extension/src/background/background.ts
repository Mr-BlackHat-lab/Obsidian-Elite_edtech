// ============================================================
// LearnPulse AI — background.ts
//
// LINES 1–80:    OWNED BY T2 (audio capture + WebSocket client)
//                ⚠️  DO NOT EDIT — coordinate with T2
//
// LINES 81+:     OWNED BY T3 (message relay + badge updates)
// ============================================================

// ── T2 SECTION PLACEHOLDER (lines 1–80) ──────────────────────
// T2 will implement:
//   - tabCapture API for audio stream
//   - WebSocket client connecting to backend transcription socket
//   - chrome.tabs.sendMessage({ type: "SHOW_QUIZ", question, session_id })
//   when a live question arrives from the backend
// ─────────────────────────────────────────────────────────────

// Pad to line 81 — T2 owns above this boundary
// (In the real merged file, T2's code fills lines 1–80)

// ============================================================
// T3 SECTION: Message Relay + Badge Management   (lines 81+)
// ============================================================

import type { ExtensionMessage } from "../shared/types";

function isExtensionEnabled(value: unknown): boolean {
  return typeof value === "boolean" ? value : true;
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
  }
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
  scorePercent?: number
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
  if (areaName !== "local" || !changes.extensionEnabled) return;

  const enabled = isExtensionEnabled(changes.extensionEnabled.newValue);
  if (!enabled) {
    handleBadgeUpdate("IDLE");
    return;
  }

  chrome.storage.local.get(["sessionId", "sessionScore"], (stored) => {
    if (!stored.sessionId) return;

    const scorePercent = stored.sessionScore
      ? Math.round((stored.sessionScore as number) * 100)
      : undefined;

    handleBadgeUpdate("ACTIVE", scorePercent);
  });
});

/**
 * Relay quiz questions from the background (T2) to the active tab's content
 * script.  T2 calls this helper after receiving a live question over WebSocket.
 *
 * Usage (by T2, inside their WebSocket message handler):
 *   relayQuizToActiveTab({ type: "SHOW_QUIZ", question, session_id });
 */
export async function relayQuizToActiveTab(
  message: ExtensionMessage
): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      console.warn("[LP BG] No active tab found — cannot relay quiz.");
      return;
    }
    await chrome.tabs.sendMessage(tab.id, message);
  } catch (err) {
    console.error("[LP BG] Failed to relay quiz to tab:", err);
  }
}

/**
 * On service worker startup, restore the badge if a session was already active.
 * (Service workers can be killed and restarted by Chrome at any time.)
 */
chrome.runtime.onStartup.addListener(async () => {
  const stored = await chrome.storage.local.get([
    "sessionId",
    "sessionScore",
    "extensionEnabled",
  ]);

  if (!isExtensionEnabled(stored.extensionEnabled)) {
    handleBadgeUpdate("IDLE");
    return;
  }

  if (stored.sessionId) {
    const scorePercent = stored.sessionScore
      ? Math.round((stored.sessionScore as number) * 100)
      : undefined;
    handleBadgeUpdate("ACTIVE", scorePercent);
  }
});