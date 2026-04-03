CREATE TABLE IF NOT EXISTS scans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  status        TEXT NOT NULL CHECK (status IN ('queued','running','completed','failed','cancelled')) DEFAULT 'queued',
  mode          TEXT NOT NULL CHECK (mode IN ('single','list','sitemap','crawl')),
  root_input    TEXT NOT NULL,
  settings      JSONB NOT NULL DEFAULT '{}',
  aggregate     JSONB,
  job_id        TEXT,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS scans_status_idx ON scans(status);
CREATE INDEX IF NOT EXISTS scans_created_at_idx ON scans(created_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS scans_updated_at ON scans;
CREATE TRIGGER scans_updated_at
  BEFORE UPDATE ON scans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
