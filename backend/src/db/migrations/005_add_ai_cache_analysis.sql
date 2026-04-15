ALTER TABLE page_results
  ADD COLUMN IF NOT EXISTS ai_cache_analysis JSONB;
