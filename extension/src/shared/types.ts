// ============================================================
// Shared types for LearnPulse AI extension
// Used by content_script.ts, quiz_overlay.tsx, Popup.tsx, Dashboard.tsx
// ============================================================

export interface Question {
  question_id: string;
  question: string;
  type: "mcq" | "short_answer";
  difficulty: "easy" | "medium" | "hard";
  options: string[];
  answer: string;
  explanation: string;
  concept_tag: string;
}

export interface SubmitAnswerResponse {
  correct: boolean;
  explanation: string;
  updated_score: number;
  weak_topics: string[];
}

export interface AnswerResult extends SubmitAnswerResponse {
  question_id: string;
  user_answer: string;
}

export interface SessionStats {
  sessionId: string | null;
  sessionScore: number;
  questionsAsked: number;
  correctCount: number;
  weakTopics: string[];
  streak: number;
  sessionVideoUrl: string | null;
  transcript: string | null;
}

// Message types exchanged between background.ts and content_script.ts
export type ExtensionMessage =
  | { type: "SHOW_QUIZ"; question: Question; session_id: string }
  | { type: "UPDATE_BADGE"; status: "ACTIVE" | "IDLE"; scorePercent?: number };
