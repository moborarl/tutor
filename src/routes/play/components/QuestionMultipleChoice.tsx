import { useState } from 'react';
import type { PlayQuestion, AnswerResult } from '@shared/types';

export function QuestionMultipleChoice({
  q,
  result,
  onAnswer,
}: {
  q: PlayQuestion;
  result: AnswerResult | null;
  onAnswer: (answer: unknown) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
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

  return (
    <div className="option-list">
      {options.map((opt, i) => (
        <button
          key={i}
          className={cls(i)}
          disabled={!!result}
          onClick={() => {
            setSelected(i);
            onAnswer({ selectedIndex: i });
          }}
        >
          <span className="option-radio" />
          <span>{opt}</span>
        </button>
      ))}
    </div>
  );
}
