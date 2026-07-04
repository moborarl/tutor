-- Migration number: 0005    AI-generated vector diagram per question (fallback when no real photo assigned)

ALTER TABLE questions ADD COLUMN generated_svg TEXT;
