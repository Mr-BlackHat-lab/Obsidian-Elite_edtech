// ============================================================
// LearnPulse AI — Popup.tsx
// Main popup component. Reads session state from chrome.storage
// and subscribes to live changes so the dashboard updates in
// real-time as the user answers questions.
// ============================================================

import React, { useEffect, useState, useCallback } from "react";
import ReactDOM from "react-dom/client";
import Dashboard from "./Dashboard";

interface PopupStats {
  sessionScore: number;
  questionsAsked: number;
  correctCount: number;
  weakTopics: string[];
  streak: number;
}

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
] as const;

type PopupStorageSnapshot = Partial<{
  sessionId: string;
  sessionScore: number;
  questionsAsked: number;
  correctCount: number;
  weakTopics: string[];
  streak: number;
  extensionEnabled: boolean;
}>;

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
  const [extensionEnabled, setExtensionEnabled] = useState<boolean>(true);
  const [stats, setStats] = useState<PopupStats>(EMPTY_STATS);
  const [loaded, setLoaded] = useState<boolean>(false);

  // ── Load initial state from chrome.storage.local ──────────
  const loadStats = useCallback(() => {
    chrome.storage.local.get([...STORAGE_KEYS], (data: PopupStorageSnapshot) => {
      setActive(!!data.sessionId);
      setExtensionEnabled(readBoolean(data.extensionEnabled, true));
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
      }

      if (changes.extensionEnabled) {
        setExtensionEnabled(readBoolean(changes.extensionEnabled.newValue, true));
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
          stroke="#6366f1"
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
        <span className="lp-popup-version">LearnPulse v1.0</span>
        {active && extensionEnabled && (
          <button
            onClick={() => {
              chrome.storage.local.clear(() => {
                setActive(false);
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