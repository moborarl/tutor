// AI chats frequently forget that "diagramSvg" is itself embedded inside a
// double-quoted JSON string, and write SVG attributes with double quotes
// (e.g. <svg viewBox="0 0 400 300">) without escaping them — the first quote
// after "diagramSvg": " already ends the JSON string as far as JSON.parse is
// concerned, breaking the whole document. This is a best-effort repair: scan
// for "diagramSvg": "<svg ... </svg>" spans and re-escape their raw content
// before re-attempting JSON.parse. Only meant to be used as a fallback after
// an initial JSON.parse already failed, so it can't corrupt an otherwise-valid
// document.
export function repairUnescapedDiagramSvgQuotes(raw: string): string {
  const marker = '"diagramSvg"';
  let out = '';
  let i = 0;
  for (;;) {
    const markerIdx = raw.indexOf(marker, i);
    if (markerIdx === -1) {
      out += raw.slice(i);
      break;
    }
    const colonIdx = raw.indexOf(':', markerIdx + marker.length);
    const valueStart = colonIdx === -1 ? -1 : raw.indexOf('"', colonIdx + 1);
    const svgEnd = valueStart === -1 ? -1 : raw.indexOf('</svg>', valueStart);
    const closeQuoteIdx = svgEnd === -1 ? -1 : svgEnd + '</svg>'.length;
    if (valueStart === -1 || svgEnd === -1 || raw[closeQuoteIdx] !== '"') {
      // Can't confidently locate this occurrence's boundaries; leave it as-is
      // and keep scanning past this marker so we don't loop forever.
      out += raw.slice(i, markerIdx + marker.length);
      i = markerIdx + marker.length;
      continue;
    }
    const rawSvg = raw.slice(valueStart + 1, closeQuoteIdx);
    const escaped = rawSvg
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\r?\n/g, '\\n');
    out += raw.slice(i, valueStart + 1) + escaped + '"';
    i = closeQuoteIdx + 1;
  }
  return out;
}

// Some AI chats (e.g. Gemini's code-interpreter mode) paste their own
// scratchpad/reasoning code above the actual JSON answer. If the parent
// copies everything, the document no longer starts with "{". Recover by
// slicing from the first "{" to the last "}" and trying that instead.
function extractJsonObjectSpan(raw: string): string | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return raw.slice(start, end + 1);
}

// Tries a normal JSON.parse first, then falls back to the SVG-quote repair,
// then to extracting just the {...} span (for stray code/prose around the
// JSON), trying both variants of that too. Returns null if nothing works.
export function parseJsonWithSvgRepair(raw: string): unknown | null {
  const candidates = [raw];
  const extracted = extractJsonObjectSpan(raw);
  if (extracted && extracted !== raw) candidates.push(extracted);

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      try {
        return JSON.parse(repairUnescapedDiagramSvgQuotes(candidate));
      } catch {
        // try the next candidate
      }
    }
  }
  return null;
}
