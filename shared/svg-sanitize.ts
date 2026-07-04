// Minimal allow-list sanitizer for AI-generated SVG diagrams. We don't need to
// support arbitrary SVG features (no scripts, external refs, or event handlers
// should ever be needed for a simple static diagram) so reject-on-suspicion is
// safer and simpler than trying to strip individual dangerous bits.
const DANGEROUS_PATTERN =
  /<script|<iframe|<object|<embed|<foreignobject|javascript:|on\w+\s*=/i;

export function sanitizeSvg(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!/^<svg[\s>]/i.test(trimmed) || !/<\/svg>\s*$/i.test(trimmed)) return null;
  if (DANGEROUS_PATTERN.test(trimmed)) return null;
  return trimmed;
}
