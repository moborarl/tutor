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
      <div style={{ textAlign: 'center', marginTop: 10 }}>
        <div
          style={{
            display: 'inline-block',
            border: `2px solid ${result.isCorrect ? 'var(--green)' : 'var(--red)'}`,
            borderRadius: 12,
            padding: '8px 12px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, minWidth: 60 }}>{num}</div>
          <div style={{ borderTop: `2px solid ${result.isCorrect ? 'var(--green)' : 'var(--red)'}`, margin: '4px 0' }} />
          <div style={{ fontSize: 18, fontWeight: 700, minWidth: 60 }}>{denom}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center', marginTop: 10 }}>
      <div
        style={{
          display: 'inline-block',
          textAlign: 'center',
          padding: '0 12px',
        }}
      >
        <input
          type="number"
          value={num}
          onChange={(e) => setNum(e.target.value)}
          placeholder="ตัวเศษ"
          style={{
            width: 60,
            padding: 8,
            fontSize: 18,
            fontWeight: 700,
            textAlign: 'center',
            border: '2px solid var(--border)',
            borderRadius: 8,
          }}
          disabled={!!result}
        />
        <div style={{ borderTop: '2px solid var(--ink)', margin: '6px 0', minWidth: 60 }} />
        <input
          type="number"
          value={denom}
          onChange={(e) => setDenom(e.target.value)}
          placeholder="ตัวส่วน"
          style={{
            width: 60,
            padding: 8,
            fontSize: 18,
            fontWeight: 700,
            textAlign: 'center',
            border: '2px solid var(--border)',
            borderRadius: 8,
          }}
          disabled={!!result}
        />
      </div>
      {error && <div style={{ color: 'var(--red)', marginTop: 8, fontSize: 14 }}>{error}</div>}
      <div style={{ marginTop: 12 }}>
        <button onClick={submit} disabled={!num || !denom || !!result}>
          ส่งคำตอบ
        </button>
      </div>
    </div>
  );
}
