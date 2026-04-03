import type { Question, AnswerResult } from "../shared/types";

export declare function mountQuizOverlay(
  question: Question,
  sessionId: string,
  onComplete: (result: AnswerResult) => void
): void;
