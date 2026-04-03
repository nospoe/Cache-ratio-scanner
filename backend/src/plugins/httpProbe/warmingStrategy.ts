import { sleep } from "../../utils/retry";
import { runProbe, type ProbeOptions } from "./probeRunner";
import { detectCdn } from "../cdnDetector";
import type { CacheEvent, NormalizedCacheState, ProbeRecord, WarmOutcome } from "../../types";
import { getHeader } from "../cdnDetector/adapters/base";
import { inferCacheStateFromHeaders } from "../cdnDetector/fallback";

export interface WarmingResult {
  warmEvents: CacheEvent[];
  warmedProbe: ProbeRecord;
  warmOutcome: WarmOutcome;
  attempts: number;
}

export async function warmCache(
  url: string,
  scanId: string,
  pageResultId: string,
  cdnProvider: string | null,
  cdnAdapter: ReturnType<typeof detectCdn>["adapter"],
  coldProbe: ProbeRecord,
  options: {
    maxAttempts: number;
    delayMs: number;
    probeOptions?: ProbeOptions;
  }
): Promise<WarmingResult> {
  const { maxAttempts, delayMs, probeOptions = {} } = options;
  const warmEvents: CacheEvent[] = [];
  let warmOutcome: WarmOutcome = "remained-miss";
  let lastProbe = coldProbe;
  let lastAge = coldProbe.age_seconds ?? -1;

  // Check if the initial cold response already indicates non-cacheable
  const coldState = getCacheState(coldProbe, cdnAdapter);
  if (coldState === "BYPASS" || coldState === "DYNAMIC") {
    warmOutcome = "bypass";
    return {
      warmEvents: [],
      warmedProbe: coldProbe,
      warmOutcome,
      attempts: 0,
    };
  }

  // Check for challenge/error on cold probe
  if (coldProbe.status_code === 403 || coldProbe.status_code === 429) {
    const event = makeWarmEvent(coldProbe, scanId, pageResultId, 1, "cold", cdnAdapter, false, "challenged");
    return {
      warmEvents: [event],
      warmedProbe: coldProbe,
      warmOutcome: "challenged",
      attempts: 0,
    };
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await sleep(delayMs);

    const probe = await runProbe(url, probeOptions);
    lastProbe = probe;
    const cacheState = getCacheState(probe, cdnAdapter);

    const eligible = isEligible(probe, cacheState);
    let ineligibleReason: string | undefined;
    if (!eligible) {
      ineligibleReason = getIneligibleReason(probe, cacheState);
    }

    const event: CacheEvent = {
      page_result_id: pageResultId,
      scan_id: scanId,
      request_num: attempt + 1, // +1 because cold probe is #1
      phase: "warm",
      http_status: probe.status_code,
      latency_ms: probe.latency_ms,
      age_seconds: probe.age_seconds,
      cache_state: cacheState,
      raw_cache_headers: extractCacheHeaders(probe.response_headers),
      eligible,
      ineligible_reason: ineligibleReason,
    };
    warmEvents.push(event);

    // HIT achieved
    if (cacheState === "HIT") {
      warmOutcome = "warmed-hit";
      break;
    }

    // Age increasing = object is being served from cache (CDN has stored it).
    // Only treat this as a warm hit if lastAge was already a real value (>= 0),
    // so a transition from "no Age header" (-1) to "Age: 1" doesn't falsely exit.
    const currentAge = probe.age_seconds ?? -1;
    if (lastAge >= 0 && currentAge > lastAge) {
      warmOutcome = "warmed-hit";
      lastAge = currentAge;
      break;
    }
    lastAge = currentAge;

    // Definitely bypassed
    if (cacheState === "BYPASS" || cacheState === "DYNAMIC") {
      warmOutcome = "bypass";
      break;
    }

    // Check for uncacheable headers
    const cc = getHeader(probe.response_headers, "cache-control")?.toLowerCase();
    if (cc?.includes("no-store") || cc?.includes("private")) {
      warmOutcome = "uncacheable";
      break;
    }

    // Challenge page
    if (probe.status_code === 403 || probe.status_code === 429) {
      warmOutcome = "challenged";
      break;
    }

    // 5xx server error
    if (probe.status_code >= 500) {
      warmOutcome = "error-response";
      break;
    }
  }

  return {
    warmEvents,
    warmedProbe: lastProbe,
    warmOutcome,
    attempts: warmEvents.length,
  };
}

function getCacheState(
  probe: ProbeRecord,
  adapter: ReturnType<typeof detectCdn>["adapter"]
): NormalizedCacheState {
  if (probe.error) return "UNKNOWN";
  if (adapter) {
    return adapter.normalizeCacheState(probe.response_headers);
  }
  return inferCacheStateFromHeaders(probe.response_headers, probe.status_code);
}

function makeWarmEvent(
  probe: ProbeRecord,
  scanId: string,
  pageResultId: string,
  requestNum: number,
  phase: "cold" | "warm" | "final",
  adapter: ReturnType<typeof detectCdn>["adapter"],
  eligible: boolean,
  ineligibleReason?: string
): CacheEvent {
  return {
    page_result_id: pageResultId,
    scan_id: scanId,
    request_num: requestNum,
    phase,
    http_status: probe.status_code,
    latency_ms: probe.latency_ms,
    age_seconds: probe.age_seconds,
    cache_state: getCacheState(probe, adapter),
    raw_cache_headers: extractCacheHeaders(probe.response_headers),
    eligible,
    ineligible_reason: ineligibleReason,
  };
}

function isEligible(probe: ProbeRecord, cacheState: NormalizedCacheState): boolean {
  if (probe.error) return false;
  if (cacheState === "CHALLENGE") return false;
  if (cacheState === "BYPASS") return false;
  if (probe.status_code === 0) return false;
  return true;
}

function getIneligibleReason(probe: ProbeRecord, cacheState: NormalizedCacheState): string {
  if (probe.error) return "connection_failure";
  if (cacheState === "CHALLENGE") return "challenge";
  if (cacheState === "BYPASS") return "bypass";
  if (probe.status_code === 0) return "connection_failure";
  return "unknown";
}

function extractCacheHeaders(headers: Record<string, string>): Record<string, string> {
  const relevant = [
    "cache-control",
    "cf-cache-status",
    "x-cache",
    "x-amz-cf-id",
    "x-served-by",
    "age",
    "expires",
    "pragma",
    "vary",
    "etag",
    "last-modified",
    "cf-ray",
    "x-cache-status",
    "x-cache-key",
    "cf-mitigated",
    "surrogate-control",
    "surrogate-key",
  ];
  const result: Record<string, string> = {};
  for (const key of relevant) {
    const val = getHeader(headers, key);
    if (val) result[key] = val;
  }
  return result;
}
