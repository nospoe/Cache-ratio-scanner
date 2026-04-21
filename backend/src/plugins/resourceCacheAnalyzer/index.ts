import type { PageWorkingState, ResourceCacheResult } from "../../types";
import type { RawResourceData } from "../browserCollector/metricsExtractor";
import { detectCdn } from "../cdnDetector";
import { inferCacheStateFromHeaders } from "../cdnDetector/fallback";
import { childLogger } from "../../utils/logger";

const log = childLogger("resourceCacheAnalyzer");

// Resource types to always skip — beacons, preflights have no cache semantics
const SKIP_TYPES = new Set(["ping", "preflight"]);

function shouldSkip(url: string, type: string): boolean {
  if (url.startsWith("data:") || url.startsWith("blob:")) return true;
  return SKIP_TYPES.has(type);
}

export function runResourceCacheAnalysis(state: PageWorkingState): PageWorkingState {
  const raw = state.rawResources;
  if (!raw || raw.length === 0) return state;

  log.info({ pageId: state.pageId, resourceCount: raw.length }, "Analyzing resource cache states");

  const results: ResourceCacheResult[] = raw
    .filter((r) => !shouldSkip(r.url, r.resource_type))
    .map((r: RawResourceData): ResourceCacheResult => {
      const cdnResult = detectCdn(r.response_headers);
      const cacheState = cdnResult.adapter
        ? cdnResult.adapter.normalizeCacheState(r.response_headers)
        : inferCacheStateFromHeaders(r.response_headers, r.http_status);

      return {
        scan_id: state.scanId,
        url: r.url,
        resource_type: r.resource_type,
        http_status: r.http_status,
        latency_ms: r.latency_ms,
        response_headers: r.response_headers,
        cache_state: cacheState,
        cdn_provider: cdnResult.provider,
        cdn_confidence: cdnResult.confidence,
        content_type: r.content_type,
        content_length: r.content_length,
        age_seconds: r.age_seconds,
        is_third_party: r.is_third_party,
      };
    });

  const hitCount = results.filter((r) => r.cache_state === "HIT").length;
  log.info(
    { pageId: state.pageId, total: results.length, hits: hitCount },
    "Resource cache analysis complete"
  );

  return { ...state, resourceCacheResults: results };
}
