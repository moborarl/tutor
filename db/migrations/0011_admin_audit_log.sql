CREATE TABLE IF NOT EXISTS admin_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_type TEXT NOT NULL,
  actor_parent_id INTEGER,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor_parent ON admin_audit_log(actor_parent_id, created_at);
