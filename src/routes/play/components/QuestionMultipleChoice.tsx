import { useState } from 'react';
import type { PlayQuestion, AnswerResult } from '@shared/types';

export function QuestionMultipleChoice({
  q,
  result,
  onAnswer,
  aiFeedbackAvailable,
}: {
  q: PlayQuestion;
  result: AnswerResult | null;
  onAnswer: (answer: unknown) => void;
  aiFeedbackAvailable: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [reasoningText, setReasoningText] = useState('');
  const options = ((q.content as { options?: string[] }).options ?? []) as string[];
  const correctIndex = result ? (result.correctAnswer as { correctIndex?: number }).correctIndex : null;

  function cls(i: number): string {
    if (result) {
      if (i === correctIndex) return 'option-btn correct';
      if (i === selected && !result.isCorrect) return 'option-btn wrong';
      return 'option-btn';
    }
    return i === selected ? 'option-btn selected' : 'option-btn';
  }

  const reasoningEnabled = aiFeedbackAvailable && !!q.reasoningPrompt;

  return (
    <div className="option-list">
      {options.map((opt, i) => (
        <button
          key={i}
          className={cls(i)}
          disabled={!!result}
          onClick={() => {
            setSelected(i);
            if (!reasoningEnabled) onAnswer({ selectedIndex: i });
          }}
        >
          <span className="option-radio" />
          <span>{opt}</span>
        </button>
      ))}
      {reasoningEnabled && !result && selected !== null && (
        <div className="reasoning-entry">
          <label htmlFor={`reasoning-${q.id}`}>{q.reasoningPrompt}</label>
          <textarea
            id={`reasoning-${q.id}`}
            rows={3}
            maxLength={500}
            placeholder="เขียนอธิบายสั้นๆ ได้เลย"
            value={reasoningText}
            onChange={(event) => setReasoningText(event.target.value)}
          />
          <div className="reasoning-entry-footer">
            <span>{reasoningText.length}/500</span>
            <button onClick={() => onAnswer({ selectedIndex: selected, reasoningText })}>ส่งคำตอบ</button>
          </div>
        </div>
      )}
    </div>
  );
}
