CREATE TABLE telemetry_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL CHECK (event_type IN ('page_performance', 'runtime_error', 'unhandled_rejection')),
  route TEXT NOT NULL,
  value INTEGER,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX telemetry_events_created_at_idx ON telemetry_events(created_at);
CREATE INDEX telemetry_events_type_idx ON telemetry_events(event_type);
