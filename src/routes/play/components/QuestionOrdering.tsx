import { useState } from 'react';
import type { AnswerResult, OrderingContent, OrderingAnswer } from '@shared/types';

export function QuestionOrdering({
  content,
  result,
  onAnswer,
}: {
  content: OrderingContent;
  result: AnswerResult | null;
  onAnswer: (answer: OrderingAnswer) => void;
}) {
  const items = (content as OrderingContent).items ?? [];
  const [order, setOrder] = useState<number[]>(items.map((_, i) => i));
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  function handleDragStart(idx: number) {
    if (result) return; // locked
    setDraggedIdx(idx);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDrop(dropIdx: number) {
    if (draggedIdx === null || result) return;
    const newOrder = [...order];
    const [item] = newOrder.splice(draggedIdx, 1);
    newOrder.splice(dropIdx, 0, item);
    setOrder(newOrder);
    setDraggedIdx(null);
  }

  function moveItem(fromIdx: number, toIdx: number) {
    if (result || toIdx < 0 || toIdx >= order.length) return;
    const newOrder = [...order];
    const [item] = newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, item);
    setOrder(newOrder);
  }

  function submit() {
    if (result) return;
    // order is already indices; just send it
    onAnswer({ indices: order });
  }

  if (result) {
    const res = (result.correctAnswer as OrderingAnswer | undefined)?.indices ?? [];
    return (
      <div style={{ marginTop: 10 }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            maxWidth: 400,
            margin: '0 auto',
          }}
        >
          {res.map((idx, i) => (
            <div
              key={i}
              style={{
                padding: 12,
                background: result.isCorrect ? 'rgba(0,200,0,0.1)' : 'rgba(200,0,0,0.1)',
                border: `2px solid ${result.isCorrect ? 'var(--green)' : 'var(--red)'}`,
                borderRadius: 8,
                textAlign: 'center',
                fontWeight: 700,
              }}
            >
              {i + 1}. {items[idx]}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 10, maxWidth: 400, margin: '0 auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {order.map((idx, positionInOrder) => (
          <div
            key={idx}
            draggable
            onDragStart={() => handleDragStart(positionInOrder)}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(positionInOrder)}
            style={{
              padding: 12,
              background: draggedIdx === positionInOrder ? 'rgba(0,100,255,0.2)' : 'var(--bg-card)',
              border: '2px solid var(--border)',
              borderRadius: 8,
              cursor: 'grab',
              opacity: draggedIdx === positionInOrder ? 0.5 : 1,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              userSelect: 'none',
            }}
          >
            <span style={{ flex: 1, textAlign: 'left' }}>
              {positionInOrder + 1}. {items[idx]}
            </span>
            <button
              type="button"
              className="secondary"
              onClick={() => moveItem(positionInOrder, positionInOrder - 1)}
              disabled={positionInOrder === 0}
              style={{ padding: '6px 10px', minWidth: 40 }}
              aria-label="เลื่อนขึ้น"
            >
              ↑
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => moveItem(positionInOrder, positionInOrder + 1)}
              disabled={positionInOrder === order.length - 1}
              style={{ padding: '6px 10px', minWidth: 40 }}
              aria-label="เลื่อนลง"
            >
              ↓
            </button>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        <button onClick={submit} disabled={!!result}>
          ส่งคำตอบ
        </button>
      </div>
    </div>
  );
}
