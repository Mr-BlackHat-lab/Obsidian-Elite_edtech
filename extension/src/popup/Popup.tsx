// ============================================================
// LearnPulse AI — Popup.tsx
// Main popup component. Reads session state from chrome.storage
// and subscribes to live changes so the dashboard updates in
// real-time as the user answers questions.
// ============================================================

import React, { useEffect, useState, useCallback } from "react";
import ReactDOM from "react-dom/client";
import Dashboard from "./Dashboard";
import type { ExtensionMessage } from "../shared/types";

interface PopupStats {
  sessionScore: number;
  questionsAsked: number;
  correctCount: number;
  weakTopics: string[];
  streak: number;
}

type SessionStatus = "idle" | "processing" | "active" | "failed";

const EMPTY_STATS: PopupStats = {
  sessionScore: 0,
  questionsAsked: 0,
  correctCount: 0,
  weakTopics: [],
  streak: 0,
};

// Storage keys we care about in the popup
const STORAGE_KEYS = [
  "sessionId",
  "sessionScore",
  "questionsAsked",
  "correctCount",
  "weakTopics",
  "streak",
  "extensionEnabled",
  "deviceUserId",
  "demoMode",
  "sessionStatus",
] as const;

type PopupStorageSnapshot = Partial<{
  sessionId: string;
  sessionScore: number;
  questionsAsked: number;
  correctCount: number;
  weakTopics: string[];
  streak: number;
  extensionEnabled: boolean;
  deviceUserId: string;
  demoMode: boolean;
  sessionStatus: string;
}>;

interface SiteInfo {
  siteLabel: string;
  supportedPage: boolean;
}

interface TabVideoStatusResponse {
  extensionDetected: boolean;
  videoFound: boolean;
  videoPlaying: boolean;
  extensionEnabled: boolean;
}

interface TabDebugState {
  siteLabel: string;
  supportedPage: boolean;
  extensionDetected: boolean;
  videoLabel: string;
  debugNote: string;
}

const DEFAULT_TAB_DEBUG: TabDebugState = {
  siteLabel: "Checking tab...",
  supportedPage: false,
  extensionDetected: false,
  videoLabel: "Checking...",
  debugNote: "Waiting for active tab",
};

function classifySite(urlValue: string | undefined): SiteInfo {
  if (!urlValue) {
    return { siteLabel: "No active tab", supportedPage: false };
  }

  try {
    const parsed = new URL(urlValue);
    const host = parsed.hostname;
    const path = parsed.pathname;

    if (host === "www.youtube.com" && path.startsWith("/watch")) {
      return { siteLabel: "YouTube", supportedPage: true };
    }

    if (host.endsWith(".udemy.com") && path.startsWith("/course/")) {
      return { siteLabel: "Udemy", supportedPage: true };
    }

    if (host.endsWith(".coursera.org") && path.startsWith("/learn/")) {
      return { siteLabel: "Coursera", supportedPage: true };
    }

    if (host.includes("youtube.com")) {
      return { siteLabel: "YouTube (unsupported page)", supportedPage: false };
    }

    if (host.includes("udemy.com")) {
      return { siteLabel: "Udemy (unsupported page)", supportedPage: false };
    }

    if (host.includes("coursera.org")) {
      return { siteLabel: "Coursera (unsupported page)", supportedPage: false };
    }

    return { siteLabel: "Unsupported website", supportedPage: false };
  } catch {
    return { siteLabel: "Unknown website", supportedPage: false };
  }
}

function readNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function Popup() {
  const [active, setActive] = useState<boolean>(false);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("idle");
  const [extensionEnabled, setExtensionEnabled] = useState<boolean>(true);
  const [demoMode, setDemoMode] = useState<boolean>(false);
  const [deviceUserId, setDeviceUserId] = useState<string>("");
  const [stats, setStats] = useState<PopupStats>(EMPTY_STATS);
  const [tabDebug, setTabDebug] = useState<TabDebugState>(DEFAULT_TAB_DEBUG);
  const [loaded, setLoaded] = useState<boolean>(false);

  // ── Load initial state from chrome.storage.local ──────────
  const loadStats = useCallback(() => {
    chrome.storage.local.get([...STORAGE_KEYS], (data: PopupStorageSnapshot) => {
      const hasSession = !!data.sessionId;
      setActive(hasSession);
      const raw = data.sessionStatus ?? "";
      setSessionStatus(
        !hasSession ? "idle"
        : raw === "processing" ? "processing"
        : raw === "failed" ? "failed"
        : "active"
      );
      setExtensionEnabled(readBoolean(data.extensionEnabled, true));
      setDemoMode(readBoolean(data.demoMode, false));
      setDeviceUserId(typeof data.deviceUserId === "string" ? data.deviceUserId : "");
      setStats({
        sessionScore: readNumber(data.sessionScore),
        questionsAsked: readNumber(data.questionsAsked),
        correctCount: readNumber(data.correctCount),
        weakTopics: readStringArray(data.weakTopics),
        streak: readNumber(data.streak),
      });
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    loadStats();

    // ── Subscribe to live changes ────────────────────────────
    // chrome.storage.onChanged fires immediately when content_script
    // updates storage after an answer is submitted.
    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => {
      if (areaName !== "local") return;

      setStats((prev) => ({
        sessionScore:
          changes.sessionScore ? readNumber(changes.sessionScore.newValue) : prev.sessionScore,
        questionsAsked:
          changes.questionsAsked ? readNumber(changes.questionsAsked.newValue) : prev.questionsAsked,
        correctCount:
          changes.correctCount ? readNumber(changes.correctCount.newValue) : prev.correctCount,
        weakTopics:
          changes.weakTopics ? readStringArray(changes.weakTopics.newValue) : prev.weakTopics,
        streak:
          changes.streak ? readNumber(changes.streak.newValue) : prev.streak,
      }));

      if (changes.sessionId) {
        setActive(!!changes.sessionId.newValue);
        if (!changes.sessionId.newValue) setSessionStatus("idle");
      }

      if (changes.sessionStatus) {
        const raw = changes.sessionStatus.newValue as string ?? "";
        setSessionStatus(
          raw === "processing" ? "processing"
          : raw === "failed" ? "failed"
          : raw === "ready" ? "active"
          : "active"
        );
      }

      if (changes.extensionEnabled) {
        setExtensionEnabled(readBoolean(changes.extensionEnabled.newValue, true));
      }

      if (changes.demoMode) {
        setDemoMode(readBoolean(changes.demoMode.newValue, false));
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [loadStats]);

  const toggleExtension = useCallback(() => {
    const nextEnabled = !extensionEnabled;
    chrome.storage.local.set({ extensionEnabled: nextEnabled }, () => {
      setExtensionEnabled(nextEnabled);
    });
  }, [extensionEnabled]);

  const toggleDemoMode = useCallback(() => {
    const next = !demoMode;
    chrome.storage.local.set({ demoMode: next }, () => {
      setDemoMode(next);
    });
  }, [demoMode]);

  const refreshTabDebug = useCallback(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      const siteInfo = classifySite(tab?.url);

      if (!tab?.id) {
        setTabDebug({
          siteLabel: siteInfo.siteLabel,
          supportedPage: siteInfo.supportedPage,
          extensionDetected: false,
          videoLabel: "No tab selected",
          debugNote: "Could not access active tab",
        });
        return;
      }

      if (!siteInfo.supportedPage) {
        setTabDebug({
          siteLabel: siteInfo.siteLabel,
          supportedPage: false,
          extensionDetected: false,
          videoLabel: "Unsupported page",
          debugNote: "Open a supported video page for detection",
        });
        return;
      }

      const message: ExtensionMessage = { type: "GET_VIDEO_STATUS" };

      chrome.tabs.sendMessage(
        tab.id,
        message,
        (response: TabVideoStatusResponse | undefined) => {
          const runtimeError = chrome.runtime.lastError;

          if (runtimeError || !response) {
            console.debug("[LP Popup][Debug] Content script not detected:", runtimeError?.message);
            setTabDebug({
              siteLabel: siteInfo.siteLabel,
              supportedPage: true,
              extensionDetected: false,
              videoLabel: "No content response",
              debugNote: "Extension did not detect this page yet",
            });
            return;
          }

          const videoLabel = response.videoFound
            ? response.videoPlaying
              ? "Video playing"
              : "Video paused"
            : "No video found";

          console.debug("[LP Popup][Debug] Detection response:", response);
          setTabDebug({
            siteLabel: siteInfo.siteLabel,
            supportedPage: true,
            extensionDetected: response.extensionDetected,
            videoLabel,
            debugNote: response.extensionEnabled
              ? "Content script detected on this tab"
              : "Extension toggle is OFF on this page",
          });
        }
      );
    });
  }, []);

  useEffect(() => {
    refreshTabDebug();

    const intervalId = window.setInterval(() => {
      refreshTabDebug();
    }, 2500);

    return () => window.clearInterval(intervalId);
  }, [refreshTabDebug]);

  const statusClass = !extensionEnabled
    ? "is-disabled"
    : active
      ? "is-active"
      : "is-idle";

  const statusLabel = !extensionEnabled
    ? "Disabled"
    : active
      ? "Active"
      : "Idle";

  if (!loaded) {
    return (
      <div className="lp-popup-loading">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#f1f1f1"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="lp-popup-spinner"
        >
          <path d="M12 2a10 10 0 0 1 10 10" />
        </svg>
      </div>
    );
  }

  return (
    <div className="lp-popup-shell">
      {/* ── Brand header ── */}
      <div className="lp-popup-header">
        <div className="lp-popup-brand">
          🧠 LearnPulse AI
        </div>

        {/* Status pill */}
        <div className={`lp-popup-status ${statusClass}`}>
          <div className="lp-popup-status-dot" />
          <span className="lp-popup-status-label">
            {statusLabel}
          </span>
        </div>
      </div>

      <div className="lp-extension-toggle-row">
        <span className="lp-extension-toggle-label">Extension</span>
        <button
          type="button"
          onClick={toggleExtension}
          className={`lp-extension-toggle ${extensionEnabled ? "is-on" : "is-off"}`}
        >
          {extensionEnabled ? "ON" : "OFF"}
        </button>
      </div>

      <div className="lp-extension-toggle-row">
        <span className="lp-extension-toggle-label">Demo mode (30s)</span>
        <button
          type="button"
          onClick={toggleDemoMode}
          className={`lp-extension-toggle ${demoMode ? "is-on" : "is-off"}`}
        >
          {demoMode ? "ON" : "OFF"}
        </button>
      </div>

      <div className="lp-tab-debug">
        <div className="lp-tab-debug-row">
          <span className="lp-tab-debug-key">Website</span>
          <span className={`lp-tab-debug-value ${tabDebug.supportedPage ? "tone-good" : "tone-warn"}`}>
            {tabDebug.siteLabel}
          </span>
        </div>
        <div className="lp-tab-debug-row">
          <span className="lp-tab-debug-key">Detection</span>
          <span className={`lp-tab-debug-value ${tabDebug.extensionDetected ? "tone-good" : "tone-bad"}`}>
            {tabDebug.extensionDetected ? "Detected" : "Not detected"}
          </span>
        </div>
        <div className="lp-tab-debug-row">
          <span className="lp-tab-debug-key">Video</span>
          <span className={`lp-tab-debug-value ${tabDebug.videoLabel === "Video playing" ? "tone-good" : "tone-muted"}`}>
            {tabDebug.videoLabel}
          </span>
        </div>
        <p className="lp-tab-debug-note">{tabDebug.debugNote}</p>
      </div>

      {/* ── Divider ── */}
      <div className="lp-popup-divider" />

      {/* ── Content ── */}
      {!extensionEnabled ? (
        <div className="lp-popup-empty">
          <div className="lp-popup-empty-icon">🛑</div>
          <p className="lp-popup-empty-text">
            LearnPulse is disabled. Turn the extension ON to resume quiz checkpoints.
          </p>
        </div>
      ) : sessionStatus === "processing" ? (
        <div className="lp-popup-empty">
          <div className="lp-popup-empty-icon">⏳</div>
          <p className="lp-popup-empty-text">
            Fetching transcript and generating questions… this takes a few seconds.
          </p>
        </div>
      ) : sessionStatus === "failed" ? (
        <div className="lp-popup-empty">
          <div className="lp-popup-empty-icon">⚠️</div>
          <p className="lp-popup-empty-text">
            We couldn't finish processing this video right now. Please try again in a moment or play a different video.
          </p>
        </div>
      ) : active ? (
        <Dashboard stats={stats} />
      ) : (
        <div className="lp-popup-empty">
          <div className="lp-popup-empty-icon">🎬</div>
          <p className="lp-popup-empty-text">
            Open YouTube, Udemy, or Coursera and play a video to start learning.
          </p>
        </div>
      )}

      {/* ── Footer ── */}
      <div className="lp-popup-footer">
        <span className="lp-popup-version">LearnPulse v1.0{deviceUserId ? ` · ${deviceUserId}` : ""}</span>
        {active && extensionEnabled && (
          <button
            onClick={() => {
              chrome.storage.local.clear(() => {
                setActive(false);
                setSessionStatus("idle");
                setStats(EMPTY_STATS);
                setExtensionEnabled(true);
              });
            }}
            className="lp-reset-btn"
          >
            Reset session
          </button>
        )}
      </div>
    </div>
  );
}

const popupRoot = document.getElementById("popup-root");
if (popupRoot) {
  ReactDOM.createRoot(popupRoot).render(<Popup />);
}

export default Popup;