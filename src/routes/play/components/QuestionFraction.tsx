import { useState } from 'react';
import type { AnswerResult } from '@shared/types';

interface FractionAnswer {
  numerator: number;
  denominator: number;
}

export function QuestionFraction({
  result,
  onAnswer,
}: {
  result: AnswerResult | null;
  onAnswer: (answer: FractionAnswer) => void;
}) {
  const [num, setNum] = useState('');
  const [denom, setDenom] = useState('');
  const [error, setError] = useState('');

  function submit() {
    setError('');
    const n = parseInt(num, 10);
    const d = parseInt(denom, 10);
    if (isNaN(n) || isNaN(d)) {
      setError('กรุณากรอกตัวเลข');
      return;
    }
    if (d === 0) {
      setError('ตัวส่วนต้องไม่เป็น 0');
      return;
    }
    if (result) return; // already answered, locked
    onAnswer({ numerator: n, denominator: d });
    setNum('');
    setDenom('');
  }

  if (result) {
    const res = result.correctAnswer as FractionAnswer | undefined;
    const num = res?.numerator ?? '?';
    const denom = res?.denominator ?? '?';
    return (
      <div className="fraction-answer">
        <div className={`fraction-box ${result.isCorrect ? 'correct' : 'wrong'}`}>
          <div className="fraction-number">{num}</div>
          <div className="fraction-line" />
          <div className="fraction-number">{denom}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fraction-answer">
      <div className="fraction-input-stack">
        <input
          type="number"
          value={num}
          onChange={(e) => setNum(e.target.value)}
          placeholder="ตัวเศษ"
          className="fraction-input"
          disabled={!!result}
        />
        <div className="fraction-input-line" />
        <input
          type="number"
          value={denom}
          onChange={(e) => setDenom(e.target.value)}
          placeholder="ตัวส่วน"
          className="fraction-input"
          disabled={!!result}
        />
      </div>
      {error && <div className="fraction-error">{error}</div>}
      <div className="fraction-submit">
        <button onClick={submit} disabled={!num || !denom || !!result}>
          ส่งคำตอบ
        </button>
      </div>
    </div>
  );
}
