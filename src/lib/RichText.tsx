import React from 'react';

// Renders a text string with inline fractions (e.g. "3/4") shown stacked —
// numerator over a horizontal line over denominator — instead of slash
// notation. Worksheet prompts/explanations arrive as plain text like
// "หาคำตอบ 3/4 - 2/5"; this makes the fractions render like a real math
// worksheet without changing the stored data or asking anyone to edit prompts.
export function RichText({ text }: { text: string }) {
  return <>{renderWithFractions(text)}</>;
}

// Matches a bare fraction: digits, optional spaces around the slash, digits.
// In a math-worksheet context "\d+/\d+" is essentially always a fraction.
const FRACTION_RE = /(\d+)\s*\/\s*(\d+)/g;

function renderWithFractions(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  for (const match of text.matchAll(FRACTION_RE)) {
    const start = match.index ?? 0;
    if (start > lastIndex) parts.push(text.slice(lastIndex, start));
    parts.push(<InlineFraction key={key++} numerator={match[1]} denominator={match[2]} />);
    lastIndex = start + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function InlineFraction({ numerator, denominator }: { numerator: string; denominator: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        verticalAlign: 'middle',
        margin: '0 4px',
        lineHeight: 1,
      }}
    >
      <span style={{ fontSize: '0.82em', fontWeight: 700 }}>{numerator}</span>
      <span style={{ borderTop: '1.5px solid currentColor', width: '100%', minWidth: '0.9em' }} />
      <span style={{ fontSize: '0.82em', fontWeight: 700 }}>{denominator}</span>
    </span>
  );
}
