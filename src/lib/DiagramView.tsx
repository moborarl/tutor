import { useId } from 'react';
import type { DiagramSpec, ForceItem } from '@shared/diagram';

// Renders a single box with force arrows pointing left/right, magnitudes
// labeled — the classic "find the resultant force" diagram. Built as real SVG
// elements (not string concatenation an AI could get wrong), so it's always
// well-formed regardless of how many items are on each side.
function ForceArrowsSvg({ items }: { items: ForceItem[] }) {
  const arrowId = useId();
  const left = items.filter((i) => i.direction === 'left');
  const right = items.filter((i) => i.direction === 'right');

  return (
    <svg viewBox="0 0 520 130" className="diagram-svg" role="img" aria-label="แผนภาพแรงกระทำต่อกล่อง">
      <defs>
        <marker id={arrowId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
        </marker>
      </defs>
      <line x1="54" y1="104" x2="466" y2="104" stroke="#8a97a8" strokeWidth="3" />
      <rect x="224" y="44" width="72" height="60" rx="6" fill="#d7dee8" stroke="#4a5568" strokeWidth="3" />
      <text x="260" y="80" textAnchor="middle" fontWeight="800" fill="#1c2430">กล่อง</text>
      {left.map((item, i) => {
        const y = 42 + i * 28;
        return (
          <g key={`l${i}`} color="#2b6cb0">
            <line x1="265" y1={y} x2="85" y2={y} stroke="#2b6cb0" strokeWidth="4" markerEnd={`url(#${arrowId})`} />
            <text x="108" y={y - 10} fill="#1c2430">{item.magnitude} นิวตัน</text>
          </g>
        );
      })}
      {right.map((item, i) => {
        const y = 42 + i * 28;
        return (
          <g key={`r${i}`} color="#2f855a">
            <line x1="255" y1={y} x2="435" y2={y} stroke="#2f855a" strokeWidth="4" markerEnd={`url(#${arrowId})`} />
            <text x="340" y={y - 10} fill="#1c2430">{item.magnitude} นิวตัน</text>
          </g>
        );
      })}
    </svg>
  );
}

function ForceArrowsGrid({ panels }: { panels: { label: string; items: ForceItem[] }[] }) {
  return (
    <div className="diagram-grid">
      {panels.map((panel, i) => (
        <div key={i} className="diagram-grid-panel">
          <strong>{panel.label}</strong>
          <ForceArrowsSvg items={panel.items} />
        </div>
      ))}
    </div>
  );
}

const DIRECTION_STYLE: Record<string, { x1: number; y1: number; x2: number; y2: number; textX: number; textY: number; color: string }> = {
  up: { x1: 260, y1: 64, x2: 260, y2: 20, textX: 270, textY: 24, color: '#2b6cb0' },
  down: { x1: 260, y1: 126, x2: 260, y2: 160, textX: 270, textY: 158, color: '#b7791f' },
  right: { x1: 298, y1: 95, x2: 420, y2: 95, textX: 426, textY: 100, color: '#2f855a' },
  left: { x1: 222, y1: 95, x2: 100, y2: 95, textX: 82, textY: 100, color: '#c53030' },
};

function DirectionArrowsSvg({ arrows }: { arrows: { direction: 'up' | 'down' | 'left' | 'right'; label: string }[] }) {
  const arrowId = useId();
  return (
    <svg viewBox="0 0 520 170" className="diagram-svg" role="img" aria-label="ลูกศรทิศทางรอบกล่อง">
      <defs>
        <marker id={arrowId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
        </marker>
      </defs>
      <line x1="70" y1="120" x2="450" y2="120" stroke="#8a97a8" strokeWidth="3" />
      <rect x="225" y="70" width="70" height="50" rx="5" fill="#d7dee8" stroke="#4a5568" strokeWidth="3" />
      {arrows.map((a, i) => {
        const p = DIRECTION_STYLE[a.direction];
        return (
          <g key={i} color={p.color}>
            <line x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={p.color} strokeWidth="4" markerEnd={`url(#${arrowId})`} />
            <text x={p.textX} y={p.textY} fontWeight="800" fill={p.color}>{a.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// Dispatches to the right renderer based on diagram.type. Returns null (no
// wrapper) when there's nothing to show, so callers can render it directly
// without an extra conditional.
export function DiagramView({ diagram }: { diagram: DiagramSpec | null | undefined }) {
  if (!diagram) return null;
  if (diagram.type === 'force-arrows') {
    return (
      <div className="question-diagram">
        <ForceArrowsSvg items={diagram.items} />
      </div>
    );
  }
  if (diagram.type === 'force-arrows-grid') {
    return (
      <div className="question-diagram wide">
        <ForceArrowsGrid panels={diagram.panels} />
      </div>
    );
  }
  if (diagram.type === 'direction-arrows') {
    return (
      <div className="question-diagram">
        <DirectionArrowsSvg arrows={diagram.arrows} />
      </div>
    );
  }
  return null;
}
