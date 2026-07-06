import type { QuestionWithAnswer } from '@shared/types';

// Renders the correct answer(s) for one question, read-only — the shared
// "answer key" view used by both the parent review screen and the teacher
// view. Highlights the correct choice(s) so a parent/teacher can check or
// teach from it at a glance.
export function AnswerKey({ q }: { q: QuestionWithAnswer }) {
  const content = q.content as Record<string, unknown>;
  const answer = q.answer as Record<string, unknown>;

  if (q.questionType === 'multiple_choice' && Array.isArray(content.options)) {
    return (
      <ul className="answer-key-options">
        {(content.options as string[]).map((opt, i) => {
          const isCorrect = i === answer.correctIndex;
          return (
            <li key={i} className={isCorrect ? 'correct' : ''}>
              <span className="ak-mark">{isCorrect ? '✓' : ''}</span>
              <span>{opt}</span>
            </li>
          );
        })}
      </ul>
    );
  }
  if (q.questionType === 'true_false') {
    return <div className="answer-key-line">เฉลย: <b>{answer.value ? 'ถูก ✓' : 'ผิด ✗'}</b></div>;
  }
  if (q.questionType === 'fill_blank' && Array.isArray(answer.answers)) {
    return <div className="answer-key-line">เฉลย: <b>{(answer.answers as string[]).join(' / ')}</b></div>;
  }
  if (
    q.questionType === 'matching' &&
    Array.isArray(content.left) &&
    Array.isArray(content.right) &&
    Array.isArray(answer.pairs)
  ) {
    return (
      <ul className="answer-key-options">
        {(content.left as string[]).map((l, i) => (
          <li key={i} className="correct">
            <span>{l}</span>
            <span className="ak-arrow">↔</span>
            <span>{(content.right as string[])[(answer.pairs as number[])[i]] ?? '?'}</span>
          </li>
        ))}
      </ul>
    );
  }
  return null;
}
