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

// Tries a normal JSON.parse first, then falls back to extracting just the
// {...} span (for stray code/prose pasted around the JSON). Returns null if
// neither works.
export function parseJsonWithRepair(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    const extracted = extractJsonObjectSpan(raw);
    if (!extracted) return null;
    try {
      return JSON.parse(extracted);
    } catch {
      return null;
    }
  }
}
