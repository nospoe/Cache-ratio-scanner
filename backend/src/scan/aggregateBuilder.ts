import type { ScanAggregate } from "../types";
import { query } from "../db/client";

export async function buildAggregate(
  scanId: string,
  scanDurationMs: number
): Promise<ScanAggregate> {
  // Use DB queries to compute aggregates efficiently
  const stats = await query<Record<string, unknown>>(
    `SELECT
      COUNT(*) as total_pages,
      COUNT(*) FILTER (WHERE status = 'completed') as completed_pages,
      COUNT(*) FILTER (WHERE status = 'failed') as failed_pages,
      COUNT(*) FILTER (WHERE is_challenged = true) as challenged_pages,
      COUNT(*) FILTER (WHERE is_blocked = true) as blocked_pages,
      COUNT(*) FILTER (WHERE http_status >= 400) as error_page_count,
      COUNT(*) FILTER (WHERE cache_state = 'BYPASS') as bypass_count,
      COUNT(*) FILTER (
        WHERE content_type ILIKE '%html%' AND cache_state NOT IN ('HIT','BYPASS')
      ) as non_cacheable_html_count,
      AVG((browser_metrics->>'lcp_ms')::numeric) as avg_lcp_ms,
      PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY (browser_metrics->>'lcp_ms')::numeric
      ) FILTER (WHERE browser_metrics->>'lcp_ms' IS NOT NULL) as median_lcp_ms,
      PERCENTILE_CONT(0.95) WITHIN GROUP (
        ORDER BY (browser_metrics->>'lcp_ms')::numeric
      ) FILTER (WHERE browser_metrics->>'lcp_ms' IS NOT NULL) as p95_lcp_ms,
      AVG((cold_http->>'ttfb_ms')::numeric) as avg_ttfb_ms,
      AVG(cache_hit_ratio) FILTER (WHERE cache_hit_ratio IS NOT NULL) as overall_cache_hit_ratio,
      AVG(cache_hit_ratio) FILTER (
        WHERE content_type ILIKE '%html%' AND cache_hit_ratio IS NOT NULL
      ) as document_cache_hit_ratio,
      AVG(cache_hit_ratio) FILTER (
        WHERE content_type NOT ILIKE '%html%' AND cache_hit_ratio IS NOT NULL
      ) as static_asset_cache_hit_ratio,
      COUNT(*) FILTER (WHERE ai_cache_analysis IS NOT NULL) as ai_pages_analyzed,
      COUNT(*) FILTER (WHERE (ai_cache_analysis->>'cached')::boolean = true) as ai_cached_count,
      AVG((ai_cache_analysis->>'cache_hit_ratio')::numeric)
        FILTER (WHERE ai_cache_analysis IS NOT NULL) as avg_ai_cache_hit_ratio,
      AVG((ai_cache_analysis->>'confidence')::numeric)
        FILTER (WHERE ai_cache_analysis IS NOT NULL) as avg_ai_confidence
    FROM page_results
    WHERE scan_id = $1`,
    [scanId]
  );

  // CDN distribution
  const cdnDist = await query<{ cdn_provider: string; count: string }>(
    `SELECT cdn_provider, COUNT(*) as count
     FROM page_results
     WHERE scan_id = $1 AND cdn_provider IS NOT NULL
     GROUP BY cdn_provider`,
    [scanId]
  );

  const cdn_distribution: Record<string, number> = {};
  for (const row of cdnDist) {
    cdn_distribution[row.cdn_provider] = parseInt(row.count);
  }

  const s = stats[0];
  return {
    total_pages: parseInt(String(s.total_pages ?? 0)),
    completed_pages: parseInt(String(s.completed_pages ?? 0)),
    failed_pages: parseInt(String(s.failed_pages ?? 0)),
    challenged_pages: parseInt(String(s.challenged_pages ?? 0)),
    blocked_pages: parseInt(String(s.blocked_pages ?? 0)),
    cdn_distribution,
    avg_lcp_ms: s.avg_lcp_ms != null ? parseFloat(String(s.avg_lcp_ms)) : null,
    median_lcp_ms: s.median_lcp_ms != null ? parseFloat(String(s.median_lcp_ms)) : null,
    p95_lcp_ms: s.p95_lcp_ms != null ? parseFloat(String(s.p95_lcp_ms)) : null,
    avg_ttfb_ms: s.avg_ttfb_ms != null ? parseFloat(String(s.avg_ttfb_ms)) : null,
    overall_cache_hit_ratio: s.overall_cache_hit_ratio != null ? parseFloat(String(s.overall_cache_hit_ratio)) : null,
    document_cache_hit_ratio: s.document_cache_hit_ratio != null ? parseFloat(String(s.document_cache_hit_ratio)) : null,
    static_asset_cache_hit_ratio: s.static_asset_cache_hit_ratio != null ? parseFloat(String(s.static_asset_cache_hit_ratio)) : null,
    bypass_count: parseInt(String(s.bypass_count ?? 0)),
    non_cacheable_html_count: parseInt(String(s.non_cacheable_html_count ?? 0)),
    error_page_count: parseInt(String(s.error_page_count ?? 0)),
    scan_duration_ms: scanDurationMs,
    ai_pages_analyzed: parseInt(String(s.ai_pages_analyzed ?? 0)),
    ai_cached_count: parseInt(String(s.ai_cached_count ?? 0)),
    avg_ai_cache_hit_ratio: s.avg_ai_cache_hit_ratio != null ? parseFloat(String(s.avg_ai_cache_hit_ratio)) : null,
    avg_ai_confidence: s.avg_ai_confidence != null ? parseFloat(String(s.avg_ai_confidence)) : null,
  };
}
