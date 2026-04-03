import { query } from "../client";
import type { CacheEvent } from "../../types";

export async function insertCacheEvents(events: CacheEvent[]): Promise<void> {
  if (events.length === 0) return;

  const placeholders = events.map((_, i) => {
    const base = i * 10;
    return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10})`;
  });

  const values: unknown[] = [];
  for (const e of events) {
    values.push(
      e.page_result_id,
      e.scan_id,
      e.request_num,
      e.phase,
      e.http_status,
      e.latency_ms,
      e.age_seconds,
      e.cache_state,
      JSON.stringify(e.raw_cache_headers),
      e.eligible,
    );
  }

  await query(
    `INSERT INTO cache_events
     (page_result_id, scan_id, request_num, phase, http_status, latency_ms, age_seconds, cache_state, raw_cache_headers, eligible)
     VALUES ${placeholders.join(",")}`,
    values
  );
}

export async function getCacheEvents(pageResultId: string): Promise<CacheEvent[]> {
  return query<CacheEvent>(
    "SELECT * FROM cache_events WHERE page_result_id = $1 ORDER BY request_num",
    [pageResultId]
  );
}

export async function getCacheEventsByScan(scanId: string): Promise<CacheEvent[]> {
  return query<CacheEvent>(
    "SELECT * FROM cache_events WHERE scan_id = $1 ORDER BY page_result_id, request_num",
    [scanId]
  );
}
