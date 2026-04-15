import { query, queryOne } from "../client";
import type { PageResult, PageStatus, PageWorkingState, NormalizedCacheState } from "../../types";

export async function createPageResult(params: {
  id: string;
  scan_id: string;
  original_url: string;
  crawl_depth: number;
}): Promise<PageResult> {
  const row = await queryOne<PageResult>(
    `INSERT INTO page_results (id, scan_id, original_url, final_url, crawl_depth)
     VALUES ($1, $2, $3, $3, $4)
     RETURNING *`,
    [params.id, params.scan_id, params.original_url, params.crawl_depth]
  );
  if (!row) throw new Error("Failed to create page result");
  return row;
}

export async function updatePageResult(
  id: string,
  state: PageWorkingState
): Promise<void> {
  const cdnOutput = state.cdnDetector;
  const cacheOutput = state.cacheNormalizer;
  const challengeOutput = state.challengeDetector;
  const coldProbe = state.coldProbe;
  const warmedProbe = state.warmedProbe;
  const browserMetrics = state.browserMetrics;

  await query(
    `UPDATE page_results SET
      status = $1,
      final_url = COALESCE($2, original_url),
      http_status = $3,
      content_type = $4,
      error_message = $5,
      cdn_provider = $6,
      cdn_confidence = $7,
      cdn_signals = $8,
      cdn_confidence_score = $9,
      cache_state = $10,
      warm_outcome = $11,
      cold_http = $12,
      warmed_http = $13,
      browser_metrics = $14,
      raw_response_headers = $15,
      is_challenged = $16,
      is_blocked = $17,
      challenge_type = $18,
      recommendations = $19,
      performance_score = $20,
      cache_hit_ratio = $21,
      ai_cache_analysis = $22
    WHERE id = $23`,
    [
      state.error ? "failed" : "completed",
      warmedProbe?.final_url ?? coldProbe?.final_url ?? null,
      warmedProbe?.status_code ?? coldProbe?.status_code ?? null,
      warmedProbe?.content_type ?? coldProbe?.content_type ?? null,
      state.error ?? null,
      cdnOutput?.provider ?? null,
      cdnOutput?.confidence ?? null,
      JSON.stringify(cdnOutput?.signals ?? []),
      cdnOutput?.confidenceScore ?? null,
      cacheOutput?.warmed_state ?? null,
      cacheOutput?.warm_outcome ?? null,
      coldProbe ? JSON.stringify(coldProbe) : null,
      warmedProbe ? JSON.stringify(warmedProbe) : null,
      browserMetrics ? JSON.stringify(browserMetrics) : null,
      JSON.stringify(warmedProbe?.response_headers ?? coldProbe?.response_headers ?? {}),
      challengeOutput?.is_challenged ?? false,
      challengeOutput?.is_blocked ?? false,
      challengeOutput?.challenge_type ?? null,
      JSON.stringify(state.recommendations),
      browserMetrics?.performance_score ?? null,
      cacheOutput?.cache_hit_ratio ?? null,
      state.aiCacheAnalysis ? JSON.stringify(state.aiCacheAnalysis) : null,
      id,
    ]
  );
}

export async function updatePageStatus(id: string, status: PageStatus): Promise<void> {
  await query("UPDATE page_results SET status = $1 WHERE id = $2", [status, id]);
}

export async function getPageResult(id: string): Promise<PageResult | null> {
  return queryOne<PageResult>("SELECT * FROM page_results WHERE id = $1", [id]);
}

export async function getPageResults(
  scanId: string,
  options: {
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortDir?: "asc" | "desc";
    filterCdn?: string;
    filterCacheState?: NormalizedCacheState;
    filterStatus?: string;
    search?: string;
  } = {}
): Promise<{ items: PageResult[]; total: number }> {
  const {
    page = 1,
    pageSize = 50,
    sortBy = "created_at",
    sortDir = "asc",
    filterCdn,
    filterCacheState,
    filterStatus,
    search,
  } = options;

  const conditions: string[] = ["scan_id = $1"];
  const params: unknown[] = [scanId];

  if (filterCdn) {
    params.push(filterCdn);
    conditions.push(`cdn_provider = $${params.length}`);
  }
  if (filterCacheState) {
    params.push(filterCacheState);
    conditions.push(`cache_state = $${params.length}`);
  }
  if (filterStatus) {
    params.push(filterStatus);
    conditions.push(`status = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`original_url ILIKE $${params.length}`);
  }

  const where = conditions.join(" AND ");

  // Validate sort column
  const allowedSortCols: Record<string, string> = {
    lcp_ms: "(browser_metrics->>'lcp_ms')::numeric",
    ttfb_ms: "(cold_http->>'ttfb_ms')::numeric",
    total_bytes: "(browser_metrics->>'total_bytes')::numeric",
    total_requests: "(browser_metrics->>'total_requests')::numeric",
    cache_hit_ratio: "cache_hit_ratio",
    created_at: "created_at",
    original_url: "original_url",
  };
  const orderExpr = allowedSortCols[sortBy] ?? "created_at";
  const dir = sortDir === "desc" ? "DESC" : "ASC";

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM page_results WHERE ${where}`,
    params
  );

  const offset = (page - 1) * pageSize;
  params.push(pageSize, offset);
  const items = await query<PageResult>(
    `SELECT * FROM page_results WHERE ${where}
     ORDER BY ${orderExpr} ${dir} NULLS LAST
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return {
    items,
    total: parseInt(countResult?.count ?? "0"),
  };
}

export async function getTopPagesByMetric(
  scanId: string,
  metric: "lcp_ms" | "ttfb_ms" | "cache_hit_ratio",
  direction: "asc" | "desc",
  limit = 10
): Promise<PageResult[]> {
  const colMap: Record<string, string> = {
    lcp_ms: "(browser_metrics->>'lcp_ms')::numeric",
    ttfb_ms: "(cold_http->>'ttfb_ms')::numeric",
    cache_hit_ratio: "cache_hit_ratio",
  };
  const col = colMap[metric];
  const dir = direction === "desc" ? "DESC" : "ASC";

  return query<PageResult>(
    `SELECT * FROM page_results
     WHERE scan_id = $1 AND status = 'completed' AND ${col} IS NOT NULL
     ORDER BY ${col} ${dir} NULLS LAST
     LIMIT $2`,
    [scanId, limit]
  );
}

export async function getGlobalTopPages(
  metric: "lcp_ms" | "ttfb_ms" | "cache_hit_ratio",
  direction: "asc" | "desc",
  limit = 20
): Promise<(PageResult & { scan_root_input: string; scan_created_at: string })[]> {
  const colMap: Record<string, string> = {
    lcp_ms: "(pr.browser_metrics->>'lcp_ms')::numeric",
    ttfb_ms: "(pr.cold_http->>'ttfb_ms')::numeric",
    cache_hit_ratio: "pr.cache_hit_ratio",
  };
  const col = colMap[metric];
  const dir = direction === "desc" ? "DESC" : "ASC";

  return query<PageResult & { scan_root_input: string; scan_created_at: string }>(
    `SELECT pr.*, s.root_input as scan_root_input, s.created_at as scan_created_at
     FROM page_results pr
     JOIN scans s ON s.id = pr.scan_id
     WHERE pr.status = 'completed' AND ${col} IS NOT NULL
     ORDER BY ${col} ${dir} NULLS LAST
     LIMIT $1`,
    [limit]
  );
}

export async function countPagesByScan(scanId: string): Promise<{
  total: number;
  completed: number;
  failed: number;
  challenged: number;
}> {
  const rows = await query<{ status: string; is_challenged: boolean; count: string }>(
    `SELECT status, is_challenged, COUNT(*) as count
     FROM page_results WHERE scan_id = $1 GROUP BY status, is_challenged`,
    [scanId]
  );

  let total = 0;
  let completed = 0;
  let failed = 0;
  let challenged = 0;

  for (const row of rows) {
    const c = parseInt(row.count);
    total += c;
    if (row.status === "completed") completed += c;
    if (row.status === "failed") failed += c;
    if (row.is_challenged) challenged += c;
  }

  return { total, completed, failed, challenged };
}
