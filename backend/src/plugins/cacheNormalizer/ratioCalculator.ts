import type { CacheEvent, NormalizedCacheState } from "../../types";

export interface CacheRatios {
  cache_hit_ratio: number;
  cold_hit_ratio: number;
  warmed_hit_ratio: number;
  bypass_ratio: number;
  error_page_cache_ratio: number;
  non_200_cache_ratio: number;
}

export function calculateCacheRatios(events: CacheEvent[]): CacheRatios {
  const eligible = events.filter((e) => e.eligible);
  const total = eligible.length;

  if (total === 0) {
    return {
      cache_hit_ratio: 0,
      cold_hit_ratio: 0,
      warmed_hit_ratio: 0,
      bypass_ratio: 0,
      error_page_cache_ratio: 0,
      non_200_cache_ratio: 0,
    };
  }

  const coldEvents = eligible.filter((e) => e.phase === "cold");
  const warmEvents = eligible.filter((e) => e.phase === "warm" || e.phase === "final");

  const coldHits = coldEvents.filter((e) => e.cache_state === "HIT").length;
  const warmHits = warmEvents.filter((e) => e.cache_state === "HIT").length;
  const bypasses = events.filter((e) => e.cache_state === "BYPASS").length;
  const allBypassable = events.filter((e) => e.cache_state !== "CHALLENGE").length;

  // cache_hit_ratio is based on warm probes only — cold is always a MISS for
  // uncached pages and including it would permanently cap the ratio below 100%.
  const warmTotal = warmEvents.length;

  // Error page cache: events with non-2xx status that were HIT
  const non200 = eligible.filter((e) => e.http_status < 200 || e.http_status >= 300);
  const non200Hits = non200.filter((e) => e.cache_state === "HIT").length;
  const errorPage = eligible.filter((e) => e.http_status >= 400);
  const errorPageHits = errorPage.filter((e) => e.cache_state === "HIT").length;

  return {
    cache_hit_ratio: warmTotal > 0 ? warmHits / warmTotal : 0,
    cold_hit_ratio: coldEvents.length > 0 ? coldHits / coldEvents.length : 0,
    warmed_hit_ratio: warmEvents.length > 0 ? warmHits / warmEvents.length : 0,
    bypass_ratio: allBypassable > 0 ? bypasses / allBypassable : 0,
    error_page_cache_ratio: errorPage.length > 0 ? errorPageHits / errorPage.length : 0,
    non_200_cache_ratio: non200.length > 0 ? non200Hits / non200.length : 0,
  };
}
