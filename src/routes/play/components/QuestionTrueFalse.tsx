import { useState } from 'react';
import type { AnswerResult } from '@shared/types';

export function QuestionTrueFalse({
  result,
  onAnswer,
}: {
  result: AnswerResult | null;
  onAnswer: (answer: unknown) => void;
}) {
  const [selected, setSelected] = useState<boolean | null>(null);
  const correctValue = result ? (result.correctAnswer as { value?: boolean }).value : null;

  function cls(v: boolean): string {
    if (result) {
      if (v === correctValue) return 'option-btn correct';
      if (v === selected && !result.isCorrect) return 'option-btn wrong';
      return 'option-btn';
    }
    return v === selected ? 'option-btn selected' : 'option-btn';
  }

  return (
    <div className="option-list" style={{ flexDirection: 'row', justifyContent: 'center' }}>
      <button
        className={cls(true)}
        style={{ flex: 1, fontSize: 28 }}
        disabled={!!result}
        onClick={() => { setSelected(true); onAnswer({ value: true }); }}
      >
        ✓ ถูก
      </button>
      <button
        className={cls(false)}
        style={{ flex: 1, fontSize: 28 }}
        disabled={!!result}
        onClick={() => { setSelected(false); onAnswer({ value: false }); }}
      >
        ✗ ผิด
      </button>
    </div>
  );
}
