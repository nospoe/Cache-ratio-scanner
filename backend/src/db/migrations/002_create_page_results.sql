CREATE TABLE IF NOT EXISTS page_results (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id               UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  original_url          TEXT NOT NULL,
  final_url             TEXT NOT NULL DEFAULT '',
  crawl_depth           INTEGER NOT NULL DEFAULT 0,

  status                TEXT NOT NULL CHECK (status IN ('pending','running','completed','failed')) DEFAULT 'pending',
  http_status           INTEGER,
  content_type          TEXT,
  error_message         TEXT,

  cdn_provider          TEXT,
  cdn_confidence        TEXT CHECK (cdn_confidence IN ('high','medium','low','none')),
  cdn_signals           JSONB NOT NULL DEFAULT '[]',
  cdn_confidence_score  FLOAT,

  cache_state           TEXT CHECK (cache_state IN (
                          'HIT','MISS','BYPASS','EXPIRED','REVALIDATED',
                          'STALE','DYNAMIC','ERROR','CHALLENGE','UNKNOWN'
                        )),
  warm_outcome          TEXT CHECK (warm_outcome IN (
                          'warmed-hit','remained-miss','bypass',
                          'uncacheable','challenged','error-response'
                        )),

  cold_http             JSONB,
  warmed_http           JSONB,
  browser_metrics       JSONB,

  raw_response_headers  JSONB NOT NULL DEFAULT '{}',

  is_challenged         BOOLEAN NOT NULL DEFAULT false,
  is_blocked            BOOLEAN NOT NULL DEFAULT false,
  challenge_type        TEXT,

  recommendations       JSONB NOT NULL DEFAULT '[]',
  performance_score     NUMERIC(5,2),
  cache_hit_ratio       FLOAT,

  CONSTRAINT page_results_scan_url_unique UNIQUE (scan_id, original_url)
);

CREATE INDEX IF NOT EXISTS page_results_scan_id_idx ON page_results(scan_id);
CREATE INDEX IF NOT EXISTS page_results_cdn_idx ON page_results(cdn_provider);
CREATE INDEX IF NOT EXISTS page_results_cache_state_idx ON page_results(cache_state);
CREATE INDEX IF NOT EXISTS page_results_status_idx ON page_results(scan_id, status);
-- For ranking queries on numeric JSON values
CREATE INDEX IF NOT EXISTS page_results_lcp_idx ON page_results USING btree ((browser_metrics->>'lcp_ms'));
CREATE INDEX IF NOT EXISTS page_results_ttfb_idx ON page_results USING btree ((cold_http->>'ttfb_ms'));
