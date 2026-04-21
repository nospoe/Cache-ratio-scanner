import { query } from "../client";
import type { ResourceCacheResult } from "../../types";

export async function insertResourceCacheResults(
  results: ResourceCacheResult[]
): Promise<void> {
  if (results.length === 0) return;

  for (const r of results) {
    await query(
      `INSERT INTO resource_cache_results
        (page_result_id, scan_id, url, resource_type, http_status, latency_ms,
         response_headers, cache_state, cdn_provider, cdn_confidence,
         content_type, content_length, age_seconds, is_third_party)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        r.page_result_id ?? null,
        r.scan_id,
        r.url,
        r.resource_type,
        r.http_status ?? null,
        r.latency_ms ?? null,
        JSON.stringify(r.response_headers),
        r.cache_state ?? null,
        r.cdn_provider ?? null,
        r.cdn_confidence ?? null,
        r.content_type ?? null,
        r.content_length ?? null,
        r.age_seconds ?? null,
        r.is_third_party,
      ]
    );
  }
}

export async function getResourceCacheResults(
  pageResultId: string
): Promise<ResourceCacheResult[]> {
  return query<ResourceCacheResult>(
    `SELECT * FROM resource_cache_results
     WHERE page_result_id = $1
     ORDER BY resource_type, url`,
    [pageResultId]
  );
}
