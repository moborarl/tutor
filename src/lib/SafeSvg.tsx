import { sanitizeSvg } from '@shared/svg-sanitize';

// Renders AI-generated SVG diagram markup. The server already sanitizes before
// storing it, but we re-check here as a second line of defense before using
// dangerouslySetInnerHTML.
export function SafeSvg({ svg, className }: { svg: string; className?: string }) {
  const clean = sanitizeSvg(svg);
  if (!clean) return null;
  return <div className={className} dangerouslySetInnerHTML={{ __html: clean }} />;
}
