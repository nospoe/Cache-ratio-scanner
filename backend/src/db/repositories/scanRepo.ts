import { query, queryOne } from "../client";
import type { Scan, ScanStatus, ScanAggregate, ScanSettings, ScanMode } from "../../types";
// Repos use `any` casts via the relaxed query<T> signature

export async function createScan(params: {
  id: string;
  mode: ScanMode;
  root_input: string;
  settings: ScanSettings;
  job_id?: string;
}): Promise<Scan> {
  const row = await queryOne<Scan>(
    `INSERT INTO scans (id, mode, root_input, settings, job_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [params.id, params.mode, params.root_input, JSON.stringify(params.settings), params.job_id ?? null]
  );
  if (!row) throw new Error("Failed to create scan");
  return row;
}

export async function getScan(id: string): Promise<Scan | null> {
  return queryOne<Scan>("SELECT * FROM scans WHERE id = $1", [id]);
}

export async function listScans(page = 1, pageSize = 20): Promise<{ scans: Scan[]; total: number }> {
  const offset = (page - 1) * pageSize;
  const [scans, countResult] = await Promise.all([
    query<Scan>(
      "SELECT * FROM scans ORDER BY created_at DESC LIMIT $1 OFFSET $2",
      [pageSize, offset]
    ),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM scans"),
  ]);
  return { scans, total: parseInt(countResult?.count ?? "0") };
}

export async function updateScanStatus(
  id: string,
  status: ScanStatus,
  errorMessage?: string
): Promise<void> {
  await query(
    `UPDATE scans SET status = $1, error_message = $2 WHERE id = $3`,
    [status, errorMessage ?? null, id]
  );
}

export async function updateScanAggregate(
  id: string,
  aggregate: ScanAggregate
): Promise<void> {
  await query(
    `UPDATE scans SET aggregate = $1, status = 'completed' WHERE id = $2`,
    [JSON.stringify(aggregate), id]
  );
}

export async function updateScanJobId(id: string, jobId: string): Promise<void> {
  await query("UPDATE scans SET job_id = $1 WHERE id = $2", [jobId, id]);
}

export interface GlobalScanCacheResult {
  id: string;
  root_input: string;
  created_at: string;
  overall_cache_hit_ratio: number;
  total_pages: number;
  completed_pages: number;
}

export async function getGlobalTopScansByCacheRatio(
  direction: "asc" | "desc",
  limit = 20
): Promise<GlobalScanCacheResult[]> {
  const dir = direction === "desc" ? "DESC" : "ASC";
  return query<GlobalScanCacheResult>(
    `SELECT id, root_input, created_at,
            (aggregate->>'overall_cache_hit_ratio')::numeric as overall_cache_hit_ratio,
            (aggregate->>'total_pages')::int as total_pages,
            (aggregate->>'completed_pages')::int as completed_pages
     FROM scans
     WHERE status = 'completed'
       AND aggregate->>'overall_cache_hit_ratio' IS NOT NULL
     ORDER BY (aggregate->>'overall_cache_hit_ratio')::numeric ${dir} NULLS LAST
     LIMIT $1`,
    [limit]
  );
}

export async function cancelScan(id: string): Promise<boolean> {
  const result = await query(
    `UPDATE scans SET status = 'cancelled' WHERE id = $1 AND status IN ('queued','running') RETURNING id`,
    [id]
  );
  return result.length > 0;
}
