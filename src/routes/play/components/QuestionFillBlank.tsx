import { useState } from 'react';
import type { PlayQuestion, AnswerResult } from '@shared/types';

export function QuestionFillBlank({
  q,
  result,
  onAnswer,
}: {
  q: PlayQuestion;
  result: AnswerResult | null;
  onAnswer: (answer: unknown) => void;
}) {
  const [text, setText] = useState('');
  const hint = (q.content as { hint?: string }).hint;
  const correctAnswers = result
    ? ((result.correctAnswer as { answers?: string[] }).answers ?? [])
    : [];

  return (
    <div className="option-list fill-blank-answer">
      {hint && <div className="muted">คำใบ้: {hint}</div>}
      <input
        className="fill-blank-input"
        value={text}
        disabled={!!result}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && text.trim()) onAnswer({ text });
        }}
        placeholder="พิมพ์คำตอบ..."
      />
      {!result && (
        <button disabled={!text.trim()} onClick={() => onAnswer({ text })}>ตอบ</button>
      )}
      {result && !result.isCorrect && (
        <div className="muted" style={{ fontSize: 18 }}>
          เฉลย: <b style={{ color: 'var(--green)' }}>{correctAnswers.join(' / ')}</b>
        </div>
      )}
    </div>
  );
}
