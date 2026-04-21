CREATE TABLE IF NOT EXISTS resource_cache_results (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_result_id   UUID NOT NULL REFERENCES page_results(id) ON DELETE CASCADE,
  scan_id          UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  url              TEXT NOT NULL,
  resource_type    TEXT NOT NULL DEFAULT 'other',
  http_status      INTEGER,
  latency_ms       INTEGER,
  response_headers JSONB NOT NULL DEFAULT '{}',
  cache_state      TEXT CHECK (cache_state IN (
                     'HIT','MISS','BYPASS','EXPIRED','REVALIDATED',
                     'STALE','DYNAMIC','ERROR','CHALLENGE','UNKNOWN'
                   )),
  cdn_provider     TEXT,
  cdn_confidence   TEXT CHECK (cdn_confidence IN ('high','medium','low','none')),
  content_type     TEXT,
  content_length   BIGINT,
  age_seconds      INTEGER,
  is_third_party   BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS resource_cache_results_page_idx ON resource_cache_results(page_result_id);
CREATE INDEX IF NOT EXISTS resource_cache_results_scan_idx  ON resource_cache_results(scan_id);
CREATE INDEX IF NOT EXISTS resource_cache_results_state_idx ON resource_cache_results(cache_state);
