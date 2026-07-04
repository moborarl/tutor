// Minimal allow-list sanitizer for AI-generated SVG diagrams. We don't need to
// support arbitrary SVG features (no scripts, external refs, or event handlers
// should ever be needed for a simple static diagram) so reject-on-suspicion is
// safer and simpler than trying to strip individual dangerous bits.
const DANGEROUS_PATTERN =
  /<script|<iframe|<object|<embed|<foreignobject|javascript:|on\w+\s*=/i;

export function sanitizeSvg(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let trimmed = raw.trim();
  if (!/^<svg[\s>]/i.test(trimmed)) return null;
  if (DANGEROUS_PATTERN.test(trimmed)) return null;
  // AI output is sometimes truncated (hit a length limit) before the closing
  // </svg>. Inner tags left open (</text>, </g>, ...) are auto-closed by the
  // browser's HTML parser when we render via innerHTML, so simply appending
  // the missing </svg> is enough to recover an otherwise-safe diagram instead
  // of silently dropping it.
  if (!/<\/svg>\s*$/i.test(trimmed)) trimmed = `${trimmed}</svg>`;
  return trimmed;
}
