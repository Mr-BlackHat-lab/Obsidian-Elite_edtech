// ============================================================
// LearnPulse AI — quiz_overlay.tsx
// The quiz UI injected into pages via Shadow DOM.
// ============================================================

import React, { useState, useEffect, useCallback } from "react";
import ReactDOM from "react-dom/client";
import type { Question, AnswerResult, SubmitAnswerResponse } from "../shared/types";

const BACKEND_URL = "http://localhost:8000";

const DIFFICULTY_LABELS: Record<Question["difficulty"], string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

const DIFFICULTY_CLASSES: Record<Question["difficulty"], string> = {
  easy: "lp-difficulty--easy",
  medium: "lp-difficulty--medium",
  hard: "lp-difficulty--hard",
};

const NOOP = (): void => undefined;

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

interface OptionButtonProps {
  index: number;
  text: string;
  selected: boolean;
  submitted: boolean;
  isCorrect: boolean;
  isWrong: boolean;
  onSelect: () => void;
}

function OptionButton({
  index,
  text,
  selected,
  submitted,
  isCorrect,
  isWrong,
  onSelect,
}: OptionButtonProps) {
  const letter = String.fromCharCode(65 + index);

  const optionClass = [
    "lp-opt",
    !submitted && selected ? "lp-opt--selected" : "",
    submitted && isCorrect ? "lp-opt--correct" : "",
    submitted && isWrong ? "lp-opt--wrong" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      onClick={submitted ? undefined : onSelect}
      disabled={submitted}
      title={`Press ${index + 1} to select`}
      className={optionClass}
    >
      <span className="lp-opt-key">{letter}</span>
      <span className="lp-opt-text">{text}</span>
      {submitted && isCorrect && <span className="lp-opt-icon">✅</span>}
      {submitted && isWrong && <span className="lp-opt-icon">❌</span>}
    </button>
  );
}

interface QuizOverlayProps {
  question: Question;
  sessionId: string;
  onComplete: (result: AnswerResult) => void;
}

function QuizOverlay({ question, sessionId, onComplete }: QuizOverlayProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [shortAnswer, setShortAnswer] = useState<string>("");
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [result, setResult] = useState<SubmitAnswerResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [animateIn, setAnimateIn] = useState<boolean>(false);

  useEffect(() => {
    requestAnimationFrame(() => setAnimateIn(true));
  }, []);

  const submitAnswer = useCallback(async (): Promise<void> => {
    if (submitted || loading) return;

    const userAnswer = question.type === "mcq" ? selectedOption : shortAnswer.trim();
    if (!userAnswer) return;

    setLoading(true);

    try {
      const response = await fetch(`${BACKEND_URL}/submit-answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          question_id: question.question_id,
          user_answer: userAnswer,
          concept_tag: question.concept_tag,
        }),
      });

      if (!response.ok) throw new Error(`submit-answer ${response.status}`);

      const data: SubmitAnswerResponse = await response.json();
      setResult(data);
    } catch {
      const normalizedUserAnswer = normalizeText(userAnswer);
      const expectedPrefix = normalizeText(question.answer).slice(0, 20);
      const correct = expectedPrefix.length > 0 && normalizedUserAnswer.includes(expectedPrefix);

      setResult({
        correct,
        explanation: question.explanation,
        updated_score: 0,
        weak_topics: [],
      });
    }

    setSubmitted(true);
    setLoading(false);
  }, [loading, question, selectedOption, sessionId, shortAnswer, submitted]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (submitted) return;

      if (question.type === "mcq") {
        const num = Number(e.key);
        if (Number.isInteger(num) && num >= 1 && num <= question.options.length) {
          e.stopPropagation();
          setSelectedOption(question.options[num - 1]);
        }
      }

      if (e.key === "Enter" && !e.shiftKey) {
        const answer = question.type === "mcq" ? selectedOption : shortAnswer;
        if (answer) {
          e.preventDefault();
          void submitAnswer();
        }
      }
    },
    [question, selectedOption, shortAnswer, submitted, submitAnswer]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [handleKeyDown]);

  function handleContinue(): void {
    if (!submitted || !result) return;

    const userAnswer = question.type === "mcq" ? (selectedOption ?? "") : shortAnswer;

    onComplete({
      question_id: question.question_id,
      user_answer: userAnswer,
      correct: result.correct,
      explanation: result.explanation,
      updated_score: result.updated_score,
      weak_topics: result.weak_topics,
    });

    document.getElementById("learnpulse-root")?.remove();
  }

  const isCorrect = result?.correct ?? false;
  const normalizedCorrectAnswer = normalizeText(question.answer);
  const difficultyClass = DIFFICULTY_CLASSES[question.difficulty];
  const canSubmit =
    question.type === "mcq" ? Boolean(selectedOption) : Boolean(shortAnswer.trim());

  return (
    <div role="dialog" aria-modal="true" aria-label="LearnPulse Quiz Checkpoint" className="lp-overlay">
      <div className={`lp-card ${animateIn ? "lp-card--in" : ""}`.trim()}>
        <div className="lp-header">
          <div className="lp-brand">LearnPulse</div>

          <div className="lp-header-badges">
            <span className={`lp-badge lp-badge--difficulty ${difficultyClass}`.trim()}>
              {DIFFICULTY_LABELS[question.difficulty]}
            </span>
            <span className="lp-badge lp-badge--concept">{question.concept_tag}</span>
          </div>
        </div>

        <div className="lp-divider" />

        <p className="lp-question">{question.question}</p>

        {question.type === "mcq" && !submitted && (
          <div className="lp-options">
            {question.options.map((opt, i) => (
              <OptionButton
                key={i}
                index={i}
                text={opt}
                selected={selectedOption === opt}
                submitted={false}
                isCorrect={false}
                isWrong={false}
                onSelect={() => setSelectedOption(opt)}
              />
            ))}
            <p className="lp-options-hint">
              Press 1-{question.options.length} to select and Enter to submit
            </p>
          </div>
        )}

        {question.type === "mcq" && submitted && (
          <div className="lp-options">
            {question.options.map((opt, i) => {
              const isCorrectOpt = normalizeText(opt) === normalizedCorrectAnswer;
              const isSelectedWrong = opt === selectedOption && !isCorrectOpt;

              return (
                <OptionButton
                  key={i}
                  index={i}
                  text={opt}
                  selected={opt === selectedOption}
                  submitted={true}
                  isCorrect={isCorrectOpt}
                  isWrong={isSelectedWrong}
                  onSelect={NOOP}
                />
              );
            })}
          </div>
        )}

        {question.type === "short_answer" && !submitted && (
          <textarea
            autoFocus
            value={shortAnswer}
            onChange={(e) => setShortAnswer(e.target.value)}
            placeholder="Type your answer here. Press Enter to submit."
            className="lp-short-answer"
          />
        )}

        {question.type === "short_answer" && submitted && (
          <div className="lp-short-answer-review">
            <strong className="lp-short-answer-label">Your answer:</strong> {shortAnswer || "(empty)"}
          </div>
        )}

        {submitted && result && (
          <div className={`lp-feedback ${isCorrect ? "lp-feedback--correct" : "lp-feedback--wrong"}`.trim()}>
            <div className={`lp-feedback-title ${isCorrect ? "lp-feedback-title--correct" : "lp-feedback-title--wrong"}`.trim()}>
              {isCorrect ? "Correct" : "Not quite"}
            </div>
            <p className="lp-feedback-text">{result.explanation ?? question.explanation}</p>
          </div>
        )}

        <div className="lp-actions">
          {!submitted ? (
            <button
              onClick={() => void submitAnswer()}
              disabled={loading || !canSubmit}
              className="lp-btn lp-btn--submit"
            >
              {loading ? (
                <span className="lp-btn-row">
                  <SpinnerIcon /> Checking...
                </span>
              ) : (
                "Submit Answer"
              )}
            </button>
          ) : (
            <button onClick={handleContinue} autoFocus className="lp-btn lp-btn--continue">
              Continue Watching
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      className="lp-inline-spinner"
    >
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}

export function mountQuizOverlay(
  question: Question,
  sessionId: string,
  onComplete: (result: AnswerResult) => void
): void {
  document.getElementById("learnpulse-root")?.remove();

  const host = document.createElement("div");
  host.id = "learnpulse-root";
  host.style.cssText =
    "position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:auto;";

  const shadow = host.attachShadow({ mode: "open" });

  const styleEl = document.createElement("style");
  styleEl.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&display=swap');

    * {
      box-sizing: border-box;
    }

    @keyframes lp-spin {
      to { transform: rotate(360deg); }
    }

    .lp-overlay {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2147483647;
      background: rgba(15, 15, 15, 0.8);
      backdrop-filter: blur(6px);
      font-family: 'Roboto', 'Segoe UI', system-ui, sans-serif;
      padding: 24px;
    }

    .lp-card {
      background: linear-gradient(180deg, #1f1f1f 0%, #181818 100%);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 16px;
      padding: 30px 32px;
      width: 620px;
      max-width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow:
        0 26px 70px rgba(0, 0, 0, 0.75),
        0 0 0 1px rgba(255, 255, 255, 0.04),
        inset 0 1px 0 rgba(255, 255, 255, 0.05);
      color: #f1f1f1;
      transform: translateY(-28px) scale(0.96);
      opacity: 0;
      transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
    }

    .lp-card--in {
      transform: translateY(0) scale(1);
      opacity: 1;
    }

    .lp-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
      gap: 8px;
    }

    .lp-brand {
      font-size: 15px;
      font-weight: 900;
      letter-spacing: 0.2px;
      color: #f1f1f1;
    }

    .lp-header-badges {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .lp-badge {
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      line-height: 1;
    }

    .lp-badge--difficulty {
      color: #f1f1f1;
      font-weight: 800;
      letter-spacing: 0.8px;
    }

    .lp-difficulty--easy {
      background: #272727;
      border: 1px solid #4f4f4f;
    }

    .lp-difficulty--medium {
      background: #303030;
      border: 1px solid #676767;
    }

    .lp-difficulty--hard {
      background: #3a3a3a;
      border: 1px solid #888888;
    }

    .lp-badge--concept {
      color: #d0d0d0;
      background: #262626;
      border: 1px solid #3f3f3f;
    }

    .lp-divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
      margin-bottom: 22px;
    }

    .lp-question {
      font-size: 17px;
      font-weight: 600;
      line-height: 1.6;
      color: #f1f1f1;
      margin: 0 0 22px 0;
    }

    .lp-options {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 24px;
    }

    .lp-options-hint {
      font-size: 11px;
      color: #8f8f8f;
      margin-top: 4px;
      text-align: right;
    }

    .lp-opt {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 13px 16px;
      border-radius: 10px;
      border: 2px solid #3a3a3a;
      background: #232323;
      color: #f1f1f1;
      font-size: 14px;
      text-align: left;
      cursor: pointer;
      transition: all 0.18s ease;
      outline: none;
      font-family: inherit;
    }

    .lp-opt:not(:disabled):hover {
      border-color: #6d6d6d;
      background: #282828;
    }

    .lp-opt:disabled {
      cursor: default;
    }

    .lp-opt--selected {
      background: #2e2e2e;
      border-color: #f1f1f1;
    }

    .lp-opt--correct {
      background: #1e2a1f;
      border-color: #4f8b57;
      color: #def2e1;
    }

    .lp-opt--wrong {
      background: #2f1f1f;
      border-color: #b45a5a;
      color: #ffdada;
    }

    .lp-opt-key {
      min-width: 24px;
      height: 24px;
      border-radius: 6px;
      background: #323232;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
      color: #e5e5e5;
      flex-shrink: 0;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
    }

    .lp-opt--selected .lp-opt-key {
      background: #f1f1f1;
      color: #151515;
    }

    .lp-opt-text {
      flex: 1;
    }

    .lp-opt-icon {
      font-size: 16px;
      flex-shrink: 0;
    }

    .lp-short-answer {
      width: 100%;
      min-height: 110px;
      background: #232323;
      border: 2px solid #3a3a3a;
      border-radius: 12px;
      color: #f1f1f1;
      font-size: 14px;
      line-height: 1.6;
      padding: 14px 16px;
      resize: vertical;
      outline: none;
      font-family: inherit;
      margin-bottom: 22px;
      transition: border-color 0.2s;
    }

    .lp-short-answer:focus {
      border-color: #f1f1f1;
    }

    .lp-short-answer-review {
      background: #232323;
      border: 1px solid #3a3a3a;
      border-radius: 10px;
      padding: 12px 16px;
      margin-bottom: 18px;
      font-size: 13px;
      color: #b8b8b8;
      line-height: 1.55;
    }

    .lp-short-answer-label {
      color: #d0d0d0;
    }

    .lp-feedback {
      padding: 18px 20px;
      border-radius: 12px;
      margin-bottom: 22px;
      border: 1px solid transparent;
    }

    .lp-feedback--correct {
      background: linear-gradient(135deg, #1e2a1f 0%, #1a231a 100%);
      border-color: #4f8b57;
      box-shadow: 0 0 20px rgba(79, 139, 87, 0.16);
    }

    .lp-feedback--wrong {
      background: linear-gradient(135deg, #2f1f1f 0%, #271919 100%);
      border-color: #b45a5a;
      box-shadow: 0 0 20px rgba(180, 90, 90, 0.16);
    }

    .lp-feedback-title {
      font-weight: 700;
      font-size: 15px;
      margin-bottom: 10px;
    }

    .lp-feedback-title--correct {
      color: #def2e1;
    }

    .lp-feedback-title--wrong {
      color: #ffd8d8;
    }

    .lp-feedback-text {
      font-size: 13px;
      line-height: 1.7;
      color: #c1c1c1;
      margin: 0;
    }

    .lp-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }

    .lp-btn {
      border: 1px solid transparent;
      border-radius: 12px;
      padding: 13px 30px;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0.3px;
      transition: all 0.2s ease;
      color: #111111;
    }

    .lp-btn--submit {
      cursor: pointer;
      background: linear-gradient(135deg, #f1f1f1 0%, #d8d8d8 100%);
      border-color: #f1f1f1;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.35);
    }

    .lp-btn--submit:disabled {
      background: #3a3a3a;
      color: #8f8f8f;
      border-color: #3a3a3a;
      cursor: not-allowed;
      box-shadow: none;
    }

    .lp-btn--continue {
      cursor: pointer;
      background: linear-gradient(135deg, #2d2d2d 0%, #252525 100%);
      color: #f1f1f1;
      border-color: #4a4a4a;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.35);
    }

    .lp-btn--continue:hover {
      background: #353535;
    }

    .lp-btn-row {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .lp-inline-spinner {
      animation: lp-spin 0.75s linear infinite;
    }

    ::-webkit-scrollbar {
      width: 6px;
    }

    ::-webkit-scrollbar-track {
      background: #161616;
      border-radius: 4px;
    }

    ::-webkit-scrollbar-thumb {
      background: #3d3d3d;
      border-radius: 4px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: #5a5a5a;
    }
  `;
  shadow.appendChild(styleEl);

   const mountPoint = document.createElement("div");
   shadow.appendChild(mountPoint);

   document.documentElement.appendChild(host);

   ReactDOM.createRoot(mountPoint).render(
     <QuizOverlay
       question={question}
       sessionId={sessionId}
       onComplete={onComplete}
     />
   );
 }
