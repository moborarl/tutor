-- Migration number: 0001    kids-tutor initial schema

CREATE TABLE parents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,        -- PBKDF2-SHA256: "iterations$saltB64$hashB64"
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE children (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id INTEGER NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  avatar TEXT NOT NULL DEFAULT '🐣',   -- emoji avatar for profile tile
  age_band TEXT NOT NULL CHECK (age_band IN ('young','older')),
  pin_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_children_parent ON children(parent_id);

CREATE TABLE subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id INTEGER NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_subjects_parent ON subjects(parent_id);

CREATE TABLE exercise_sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id INTEGER NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT '',
  age_band TEXT NOT NULL CHECK (age_band IN ('young','older')),
  source_image_r2_key TEXT NOT NULL,
  source_image_content_type TEXT NOT NULL DEFAULT 'image/jpeg',
  status TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing','extracting','pending_review','extraction_failed','published','archived')),
  extraction_provider TEXT CHECK (extraction_provider IN ('claude','other_cloud','pi')),
  extraction_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_exercise_sets_parent ON exercise_sets(parent_id);
CREATE INDEX idx_exercise_sets_status ON exercise_sets(status);

CREATE TABLE questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exercise_set_id INTEGER NOT NULL REFERENCES exercise_sets(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  question_type TEXT NOT NULL
    CHECK (question_type IN ('multiple_choice','fill_blank','matching','true_false')),
  prompt TEXT NOT NULL,
  content_json TEXT NOT NULL,          -- e.g. {"options":["a","b","c"]} or {"pairs":[...]}
  answer_json TEXT NOT NULL,           -- e.g. {"correctIndex":1} or {"answers":["cat"]}
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_questions_set ON questions(exercise_set_id);

CREATE TABLE assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  exercise_set_id INTEGER NOT NULL REFERENCES exercise_sets(id) ON DELETE CASCADE,
  assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (child_id, exercise_set_id)
);
CREATE INDEX idx_assignments_child ON assignments(child_id);

CREATE TABLE attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  exercise_set_id INTEGER NOT NULL REFERENCES exercise_sets(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  score REAL,                          -- fraction correct, 0..1
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','abandoned'))
);
CREATE INDEX idx_attempts_child ON attempts(child_id);
CREATE INDEX idx_attempts_set ON attempts(exercise_set_id);

CREATE TABLE attempt_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_id INTEGER NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  given_answer_json TEXT NOT NULL,
  is_correct INTEGER NOT NULL CHECK (is_correct IN (0,1)),
  answered_at TEXT NOT NULL DEFAULT (datetime('now')),
  time_spent_ms INTEGER,
  UNIQUE (attempt_id, question_id)
);
CREATE INDEX idx_attempt_answers_attempt ON attempt_answers(attempt_id);

CREATE TABLE parent_sessions (
  id TEXT PRIMARY KEY,
  parent_id INTEGER NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  active_child_id INTEGER REFERENCES children(id) ON DELETE SET NULL,
  pin_fail_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_parent ON parent_sessions(parent_id);
