-- Migration number: 0006    replace AI-drawn raw SVG with structured diagram data
-- (AI hand-writing SVG XML was unreliable: unescaped quotes broke JSON, output got
-- truncated before the closing tag, oversized renders overlapped surrounding
-- content. Instead the AI now sends simple structured data (e.g. force direction +
-- magnitude) and our own React components render it deterministically.)

ALTER TABLE questions DROP COLUMN generated_svg;
ALTER TABLE questions ADD COLUMN diagram_json TEXT;
