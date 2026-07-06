-- Migration number: 0007    shareable link token for exercise sets
-- A parent can generate a random unguessable token for one of their sets; anyone
-- with the link (and a parent account) can copy it into their own library.
-- NULL = not shared. SQLite allows multiple NULLs under a UNIQUE index.

ALTER TABLE exercise_sets ADD COLUMN share_token TEXT;
CREATE UNIQUE INDEX idx_exercise_sets_share_token ON exercise_sets(share_token);
