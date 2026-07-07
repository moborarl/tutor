-- Migration number: 0008    Add fraction and ordering question types

-- SQLite doesn't support ALTER CONSTRAINT, so we recreate the table
-- This is a full recreate of the questions table with the updated CHECK constraint

CREATE TABLE questions_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exercise_set_id INTEGER NOT NULL REFERENCES exercise_sets(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  question_type TEXT NOT NULL
    CHECK (question_type IN ('multiple_choice','fill_blank','matching','true_false','fraction','ordering')),
  prompt TEXT NOT NULL,
  content_json TEXT NOT NULL,
  answer_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved')),
  explanation TEXT,
  image_id INTEGER REFERENCES exercise_images(id) ON DELETE SET NULL,
  diagram_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Copy data from old table
INSERT INTO questions_new (id, exercise_set_id, order_index, question_type, prompt, content_json, answer_json, status, explanation, image_id, diagram_json, created_at)
SELECT id, exercise_set_id, order_index, question_type, prompt, content_json, answer_json, status, explanation, image_id, diagram_json, created_at
FROM questions;

-- Drop old table
DROP TABLE questions;

-- Rename new table
ALTER TABLE questions_new RENAME TO questions;

-- Recreate indexes
CREATE INDEX idx_questions_set ON questions(exercise_set_id);
