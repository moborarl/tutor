-- Parent-owned AI credentials and optional reasoning feedback.

CREATE TABLE parent_ai_settings (
  parent_id INTEGER PRIMARY KEY REFERENCES parents(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('openai','gemini','anthropic')),
  model TEXT NOT NULL,
  encrypted_api_key TEXT NOT NULL,
  key_last4 TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  daily_limit INTEGER NOT NULL DEFAULT 30 CHECK (daily_limit BETWEEN 1 AND 500),
  monthly_limit INTEGER NOT NULL DEFAULT 300 CHECK (monthly_limit BETWEEN 1 AND 10000),
  consent_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE questions ADD COLUMN difficulty TEXT CHECK (difficulty IN ('easy','medium','challenging'));
ALTER TABLE questions ADD COLUMN learning_objective TEXT;
ALTER TABLE questions ADD COLUMN reasoning_prompt TEXT;
ALTER TABLE questions ADD COLUMN reasoning_rubric_json TEXT;

ALTER TABLE attempt_answers ADD COLUMN reasoning_text TEXT;
ALTER TABLE attempt_answers ADD COLUMN ai_feedback_json TEXT;
ALTER TABLE attempt_answers ADD COLUMN ai_feedback_status TEXT;

CREATE TABLE ai_feedback_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id INTEGER NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  attempt_answer_id INTEGER REFERENCES attempt_answers(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_ai_feedback_usage_parent_created ON ai_feedback_usage(parent_id, created_at);
