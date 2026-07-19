import type { AttemptAnswerView, LearningMode } from '../../shared/types';

export type AnswerEndpoint = 'guided-submit' | 'exam-save';

export function canUseAnswerEndpoint(mode: LearningMode, endpoint: AnswerEndpoint): boolean {
  return (mode === 'guided' && endpoint === 'guided-submit') ||
    (mode === 'exam' && endpoint === 'exam-save');
}

export function sanitizeAttemptAnswer(
  mode: LearningMode,
  completed: boolean,
  row: AttemptAnswerView,
): AttemptAnswerView {
  if (mode === 'guided' || completed) return row;
  return {
    questionId: row.questionId,
    givenAnswer: row.givenAnswer,
    timeSpentMs: row.timeSpentMs,
    reasoningText: row.reasoningText,
  };
}
