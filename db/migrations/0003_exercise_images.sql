-- Migration number: 0003    support multiple photos per exercise set (multi-page worksheets)

CREATE TABLE exercise_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exercise_set_id INTEGER NOT NULL REFERENCES exercise_sets(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'image/jpeg',
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_exercise_images_set ON exercise_images(exercise_set_id);
