CREATE TABLE parent_ai_settings_next (
  parent_id INTEGER PRIMARY KEY REFERENCES parents(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('openai','gemini','anthropic','custom')),
  model TEXT NOT NULL,
  encrypted_api_key TEXT NOT NULL,
  key_last4 TEXT NOT NULL,
  base_url TEXT,
  api_format TEXT NOT NULL DEFAULT 'responses' CHECK (api_format IN ('responses','chat_completions')),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  daily_limit INTEGER NOT NULL DEFAULT 30 CHECK (daily_limit BETWEEN 1 AND 500),
  monthly_limit INTEGER NOT NULL DEFAULT 300 CHECK (monthly_limit BETWEEN 1 AND 10000),
  consent_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO parent_ai_settings_next (
  parent_id, provider, model, encrypted_api_key, key_last4, base_url, api_format,
  enabled, daily_limit, monthly_limit, consent_at, created_at, updated_at
)
SELECT
  parent_id, provider, model, encrypted_api_key, key_last4, NULL, 'responses',
  enabled, daily_limit, monthly_limit, consent_at, created_at, updated_at
FROM parent_ai_settings;

DROP TABLE parent_ai_settings;
ALTER TABLE parent_ai_settings_next RENAME TO parent_ai_settings;
