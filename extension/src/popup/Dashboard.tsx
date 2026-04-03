// ============================================================
// LearnPulse AI — Dashboard.tsx
// Shows session stats: accuracy ring, question counts,
// streak indicator, weak topic tags.
// ============================================================

import React from "react";

interface DashboardProps {
  stats: {
    sessionScore: number;
    questionsAsked: number;
    correctCount: number;
    weakTopics: string[];
    streak: number;
  };
}

type AccuracyTone = "tone-high" | "tone-mid" | "tone-low";

function getTone(accuracy: number): AccuracyTone {
  if (accuracy >= 80) return "tone-high";
  if (accuracy >= 50) return "tone-mid";
  return "tone-low";
}

function AccuracyRing({ accuracy, tone }: { accuracy: number; tone: AccuracyTone }) {
  const SIZE = 84;
  const STROKE = 7;
  const R = (SIZE - STROKE) / 2;
  const CIRCUM = 2 * Math.PI * R;
  const filled = (accuracy / 100) * CIRCUM;

  return (
    <div className="lp-ring">
      <svg width={SIZE} height={SIZE} className="lp-ring-svg">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          className="lp-ring-track"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          className={`lp-ring-fill ${tone}`}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${CIRCUM}`}
        />
      </svg>
      <div className="lp-ring-center">
        <span className={`lp-ring-value ${tone}`}>
          {accuracy}%
        </span>
        <span className="lp-ring-label">
          ACCURACY
        </span>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: "accent-green" | "accent-red";
}) {
  return (
    <div className="lp-stat-card">
      <span className="lp-stat-label">
        {label}
      </span>
      <span className={`lp-stat-value ${accent ?? ""}`.trim()}>
        {value}
      </span>
    </div>
  );
}

function DifficultyChip({ tone }: { tone: AccuracyTone }) {
  const label = tone === "tone-high" ? "Hard" : tone === "tone-mid" ? "Medium" : "Easy";

  return (
    <span className={`lp-difficulty-chip ${tone}`}>
      {label}
    </span>
  );
}

export default function Dashboard({ stats }: DashboardProps) {
  const accuracy =
    stats.questionsAsked > 0
      ? Math.round((stats.correctCount / stats.questionsAsked) * 100)
      : 0;

  const tone = getTone(accuracy);

  const wrongCount = stats.questionsAsked - stats.correctCount;

  return (
    <div className="lp-dashboard">
      <div className="lp-dash-top">
        <AccuracyRing accuracy={accuracy} tone={tone} />

        <div className="lp-dash-summary">
          <div className="lp-difficulty-row">
            <DifficultyChip tone={tone} />
            <span className="lp-next-level">next level</span>
          </div>

          {stats.streak >= 2 && (
            <div className="lp-streak-chip">
              🔥 {stats.streak} answer streak!
            </div>
          )}
        </div>
      </div>

      <div className="lp-stats-row">
        <StatCard label="Asked" value={stats.questionsAsked} />
        <StatCard label="Correct" value={stats.correctCount} accent="accent-green" />
        <StatCard label="Wrong" value={wrongCount} accent={wrongCount > 0 ? "accent-red" : undefined} />
      </div>

      <div className="lp-progress-wrap">
        <div className="lp-progress-head">
          <span className="lp-progress-label">
            Session progress
          </span>
          <span className="lp-progress-value">{accuracy}%</span>
        </div>
        <progress
          className={`lp-progress-meter ${tone}`}
          max={100}
          value={accuracy}
        />
      </div>

      {stats.weakTopics.length > 0 && (
        <div className="lp-weak-topics">
          <div className="lp-weak-title">
            ⚠️ Weak Topics
          </div>
          <div className="lp-weak-tags">
            {stats.weakTopics.map((topic, i) => (
              <span key={i} className="lp-weak-tag">
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}