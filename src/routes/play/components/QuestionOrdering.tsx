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
      <div className="ordering-answer">
        <div className="ordering-list">
          {res.map((idx, i) => (
            <div
              key={i}
              className={`ordering-item result ${result.isCorrect ? 'correct' : 'wrong'}`}
            >
              {i + 1}. {items[idx]}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="ordering-answer">
      <div className="ordering-list">
        {order.map((idx, positionInOrder) => (
          <div
            key={idx}
            draggable
            onDragStart={() => handleDragStart(positionInOrder)}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(positionInOrder)}
            className={`ordering-item ${draggedIdx === positionInOrder ? 'dragging' : ''}`}
          >
            <span className="ordering-label">
              {positionInOrder + 1}. {items[idx]}
            </span>
            <button
              type="button"
              className="secondary"
              onClick={() => moveItem(positionInOrder, positionInOrder - 1)}
              disabled={positionInOrder === 0}
              aria-label="เลื่อนขึ้น"
            >
              ↑
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => moveItem(positionInOrder, positionInOrder + 1)}
              disabled={positionInOrder === order.length - 1}
              aria-label="เลื่อนลง"
            >
              ↓
            </button>
          </div>
        ))}
      </div>
      <div className="ordering-submit">
        <button onClick={submit} disabled={!!result}>
          ส่งคำตอบ
        </button>
      </div>
    </div>
  );
}
