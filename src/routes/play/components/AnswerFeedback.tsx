import type { AnswerResult } from '@shared/types';

function formatAnswer(answer: unknown): string {
  if (answer == null) return '-';
  if (typeof answer === 'string' || typeof answer === 'number' || typeof answer === 'boolean') {
    return String(answer);
  }
  if (Array.isArray(answer)) return answer.join(', ');
  if (typeof answer === 'object') {
    const values = Object.values(answer as Record<string, unknown>);
    return values.map((value) => Array.isArray(value) ? value.join(', ') : String(value)).join(' · ');
  }
  return String(answer);
}

export function AnswerFeedback({
  result,
  visible,
  givenAnswer,
}: {
  result: AnswerResult;
  visible: boolean;
  givenAnswer?: unknown;
}) {
  if (!visible) return null;

  return (
    <section className={`child-answer-feedback ${result.isCorrect ? 'correct' : 'incorrect'}`} aria-live="polite">
      <h2>{result.isCorrect ? 'ตอบถูกแล้ว' : 'มาดูเฉลยกัน'}</h2>
      {givenAnswer !== undefined && <p><strong>คำตอบของเรา:</strong> {formatAnswer(givenAnswer)}</p>}
      <p><strong>คำตอบที่ถูก:</strong> {formatAnswer(result.correctAnswer)}</p>
      {result.explanation && <p>{result.explanation}</p>}
      {result.reasoningFeedback && (
        <div className={`reasoning-feedback ${result.reasoningFeedback.status}`}>
          <strong>ผู้ช่วยอ่านวิธีคิด</strong>
          <span>{result.reasoningFeedback.message}</span>
        </div>
      )}
    </section>
  );
}
