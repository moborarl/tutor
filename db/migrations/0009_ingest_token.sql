-- Migration number: 0009    per-parent AI ingest token
--
-- A parent can generate a secret token and hand it to any external AI/agent so
-- it can POST produced exercise JSON straight into the parent's library
-- (status 'pending_review'), with no browser session. Nullable until the parent
-- enables it; the UNIQUE index permits many NULLs (SQLite treats NULLs as
-- distinct), so parents who haven't enabled ingest never collide.

ALTER TABLE parents ADD COLUMN ingest_token TEXT;
CREATE UNIQUE INDEX idx_parents_ingest_token ON parents(ingest_token);
