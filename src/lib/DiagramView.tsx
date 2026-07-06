import { useId } from 'react';
import type { DiagramSpec, ForceItem } from '@shared/diagram';

// Renders a single box with force arrows pointing left/right, magnitudes
// labeled — the classic "find the resultant force" diagram. Built as real SVG
// elements (not string concatenation an AI could get wrong), so it's always
// well-formed regardless of how many items are on each side.
//
// Arrows always start at the box edge and point OUTWARD along the force
// direction (tail on the box, head away from it). This never overlaps the box,
// and matches how forces acting on an object are conventionally drawn.
function ForceArrowsSvg({ items }: { items: ForceItem[] }) {
  const arrowId = useId();
  const left = items.filter((i) => i.direction === 'left');
  const right = items.filter((i) => i.direction === 'right');

  // Box geometry (shared by both sides so arrows line up with its edges).
  const boxLeft = 232;
  const boxRight = 288;
  const boxCenterY = 82;

  // Spread N arrows vertically, centered on the box's middle.
  const yAt = (count: number, i: number) => boxCenterY - (count - 1) * 12 + i * 24;

  return (
    <svg viewBox="0 0 520 140" className="diagram-svg" role="img" aria-label="แผนภาพแรงกระทำต่อกล่อง">
      <defs>
        <marker id={arrowId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
        </marker>
      </defs>
      <line x1="36" y1="112" x2="484" y2="112" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />
      <rect x={boxLeft} y="54" width={boxRight - boxLeft} height="58" rx="8" fill="#f1f5f9" stroke="#475569" strokeWidth="2.5" />
      <text x={(boxLeft + boxRight) / 2} y="88" textAnchor="middle" fontWeight="700" fontSize="14" fill="#334155">กล่อง</text>
      {left.map((item, i) => {
        const y = yAt(left.length, i);
        return (
          <g key={`l${i}`} color="#2563eb">
            <line x1={boxLeft - 2} y1={y} x2="74" y2={y} stroke="#2563eb" strokeWidth="3.5" markerEnd={`url(#${arrowId})`} />
            <text x={(boxLeft - 2 + 74) / 2} y={y - 9} textAnchor="middle" fontSize="14" fontWeight="600" fill="#334155">{item.magnitude} นิวตัน</text>
          </g>
        );
      })}
      {right.map((item, i) => {
        const y = yAt(right.length, i);
        return (
          <g key={`r${i}`} color="#16a34a">
            <line x1={boxRight + 2} y1={y} x2="446" y2={y} stroke="#16a34a" strokeWidth="3.5" markerEnd={`url(#${arrowId})`} />
            <text x={(boxRight + 2 + 446) / 2} y={y - 9} textAnchor="middle" fontSize="14" fontWeight="600" fill="#334155">{item.magnitude} นิวตัน</text>
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

// Each arrow starts at the box edge and points outward in its direction, so it
// never overlaps the box. Colors are distinct per direction to help tell the
// applied-force arrow from the friction arrow, in a shadcn-ish slate palette.
const DIRECTION_STYLE: Record<string, { x1: number; y1: number; x2: number; y2: number; textX: number; textY: number; textAnchor: 'start' | 'middle' | 'end'; color: string }> = {
  up: { x1: 260, y1: 68, x2: 260, y2: 22, textX: 270, textY: 30, textAnchor: 'start', color: '#2563eb' },
  down: { x1: 260, y1: 122, x2: 260, y2: 162, textX: 270, textY: 156, textAnchor: 'start', color: '#d97706' },
  right: { x1: 298, y1: 95, x2: 424, y2: 95, textX: 430, textY: 100, textAnchor: 'start', color: '#16a34a' },
  left: { x1: 222, y1: 95, x2: 96, y2: 95, textX: 90, textY: 100, textAnchor: 'end', color: '#dc2626' },
};

function DirectionArrowsSvg({ arrows }: { arrows: { direction: 'up' | 'down' | 'left' | 'right'; label: string }[] }) {
  const arrowId = useId();
  return (
    <svg viewBox="0 0 520 180" className="diagram-svg" role="img" aria-label="ลูกศรทิศทางรอบกล่อง">
      <defs>
        <marker id={arrowId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
        </marker>
      </defs>
      <line x1="60" y1="122" x2="460" y2="122" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />
      <rect x="228" y="70" width="64" height="52" rx="8" fill="#f1f5f9" stroke="#475569" strokeWidth="2.5" />
      {arrows.map((a, i) => {
        const p = DIRECTION_STYLE[a.direction];
        return (
          <g key={i} color={p.color}>
            <line x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={p.color} strokeWidth="3.5" markerEnd={`url(#${arrowId})`} />
            <text x={p.textX} y={p.textY} textAnchor={p.textAnchor} fontWeight="700" fontSize="14" fill={p.color}>{a.label}</text>
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
