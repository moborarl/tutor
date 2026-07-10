import { useState } from 'react';
import type { PlayQuestion, AnswerResult } from '@shared/types';

// Tap a left item, then tap the right item that matches it.
export function QuestionMatching({
  q,
  result,
  onAnswer,
}: {
  q: PlayQuestion;
  result: AnswerResult | null;
  onAnswer: (answer: unknown) => void;
}) {
  const content = q.content as { left?: string[]; right?: string[] };
  const left = content.left ?? [];
  const right = content.right ?? [];
  const [activeLeft, setActiveLeft] = useState<number | null>(null);
  // pairs[i] = chosen right index for left[i], -1 = not chosen yet
  const [pairs, setPairs] = useState<number[]>(left.map(() => -1));

  const allPaired = pairs.every((p) => p >= 0);
  const correctPairs = result ? ((result.correctAnswer as { pairs?: number[] }).pairs ?? []) : [];

  function tapRight(ri: number) {
    if (result || activeLeft === null) return;
    const next = [...pairs];
    // unassign this right item if it was used elsewhere
    const prevIdx = next.indexOf(ri);
    if (prevIdx >= 0) next[prevIdx] = -1;
    next[activeLeft] = ri;
    setPairs(next);
    setActiveLeft(null);
  }

  return (
    <div className="matching-answer">
      <div className="match-columns">
        <div className="match-col">
          {left.map((item, li) => (
            <button
              key={li}
              className={`match-item ${activeLeft === li ? 'selected' : ''} ${pairs[li] >= 0 ? 'paired' : ''}`}
              disabled={!!result}
              onClick={() => setActiveLeft(li)}
            >
              {item}
              {pairs[li] >= 0 && <div className="muted match-pair-note">↔ {right[pairs[li]]}</div>}
              {result && (
                <div className="match-result-note">
                  {pairs[li] === correctPairs[li] ? '✓' : `✗ (${right[correctPairs[li]] ?? '?'})`}
                </div>
              )}
            </button>
          ))}
        </div>
        <div className="match-col">
          {right.map((item, ri) => (
            <button
              key={ri}
              className={`match-item ${pairs.includes(ri) ? 'paired' : ''}`}
              disabled={!!result}
              onClick={() => tapRight(ri)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      {!result && (
        <button className="match-submit" disabled={!allPaired} onClick={() => onAnswer({ pairs })}>ตอบ</button>
      )}
      {activeLeft !== null && !result && (
        <div className="muted">เลือกคู่ของ "{left[activeLeft]}" จากฝั่งขวา</div>
      )}
    </div>
  );
}
