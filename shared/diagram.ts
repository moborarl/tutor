// Structured diagram data. Instead of asking an AI to hand-write raw SVG markup
// (unreliable: unescaped quotes broke JSON, output got truncated before the
// closing tag, oversized renders overlapped surrounding content), the AI sends
// simple structured data here and our own React components render it
// deterministically — the SVG is always well-formed because we build it in code.

export type ForceItem = {
  direction: 'left' | 'right';
  magnitude: number;
};

export type DiagramSpec =
  // Arrows pushing/pulling a single box left/right, with magnitudes labeled —
  // the classic "find the resultant force" diagram.
  | { type: 'force-arrows'; items: ForceItem[] }
  // Several force-arrows panels side by side, each labeled (e.g. comparing
  // boxes A/B/C/D to find which has the largest resultant force).
  | { type: 'force-arrows-grid'; panels: { label: string; items: ForceItem[] }[] }
  // A box with labeled arrows in any of the 4 directions around it (e.g. asking
  // which direction is friction vs. applied force).
  | { type: 'direction-arrows'; arrows: { direction: 'up' | 'down' | 'left' | 'right'; label: string }[] };

function isForceItem(x: unknown): x is ForceItem {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (o.direction === 'left' || o.direction === 'right') && typeof o.magnitude === 'number';
}

function isDirectionArrow(x: unknown): x is { direction: 'up' | 'down' | 'left' | 'right'; label: string } {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    (o.direction === 'up' || o.direction === 'down' || o.direction === 'left' || o.direction === 'right') &&
    typeof o.label === 'string'
  );
}

// Validates AI/parent-provided diagram data against the known shapes. Returns
// null (drop the diagram silently) rather than throwing, since a malformed
// diagram shouldn't block importing the rest of the question.
export function validateDiagram(raw: unknown): DiagramSpec | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  if (obj.type === 'force-arrows') {
    if (!Array.isArray(obj.items)) return null;
    const items = obj.items.filter(isForceItem);
    return items.length > 0 ? { type: 'force-arrows', items } : null;
  }

  if (obj.type === 'force-arrows-grid') {
    if (!Array.isArray(obj.panels)) return null;
    const panels = obj.panels
      .map((p): { label: string; items: ForceItem[] } | null => {
        if (!p || typeof p !== 'object') return null;
        const po = p as Record<string, unknown>;
        if (typeof po.label !== 'string' || !Array.isArray(po.items)) return null;
        const items = po.items.filter(isForceItem);
        return items.length > 0 ? { label: po.label, items } : null;
      })
      .filter((p): p is { label: string; items: ForceItem[] } => p !== null);
    return panels.length > 0 ? { type: 'force-arrows-grid', panels } : null;
  }

  if (obj.type === 'direction-arrows') {
    if (!Array.isArray(obj.arrows)) return null;
    const arrows = obj.arrows.filter(isDirectionArrow);
    return arrows.length > 0 ? { type: 'direction-arrows', arrows } : null;
  }

  return null;
}
