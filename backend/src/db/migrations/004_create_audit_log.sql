CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGSERIAL PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  event       TEXT NOT NULL,
  scan_id     UUID REFERENCES scans(id) ON DELETE SET NULL,
  actor       TEXT NOT NULL DEFAULT 'system',
  details     JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS audit_log_scan_id_idx ON audit_log(scan_id);
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_event_idx ON audit_log(event);
