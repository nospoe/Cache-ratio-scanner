CREATE TABLE IF NOT EXISTS cache_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_result_id    UUID NOT NULL REFERENCES page_results(id) ON DELETE CASCADE,
  scan_id           UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  request_num       INTEGER NOT NULL,
  phase             TEXT NOT NULL CHECK (phase IN ('cold','warm','final')),
  http_status       INTEGER NOT NULL,
  latency_ms        INTEGER,
  age_seconds       INTEGER,

  cache_state       TEXT NOT NULL,
  raw_cache_headers JSONB NOT NULL DEFAULT '{}',

  eligible          BOOLEAN NOT NULL DEFAULT true,
  ineligible_reason TEXT
);

CREATE INDEX IF NOT EXISTS cache_events_page_id_idx ON cache_events(page_result_id);
CREATE INDEX IF NOT EXISTS cache_events_scan_phase_idx ON cache_events(scan_id, phase);
CREATE INDEX IF NOT EXISTS cache_events_state_idx ON cache_events(scan_id, cache_state);
