import type { CacheNormalizerOutput, CdnProvider, NormalizedCacheState, PageWorkingState, WarmOutcome } from "../../types";
import { getAdapterForProvider } from "../cdnDetector";
import { inferCacheStateFromHeaders } from "../cdnDetector/fallback";
import { calculateCacheRatios } from "./ratioCalculator";

function getState(
  headers: Record<string, string>,
  statusCode: number,
  provider: string | undefined
): NormalizedCacheState {
  if (!provider || provider === "unknown") {
    return inferCacheStateFromHeaders(headers, statusCode);
  }
  const adapter = getAdapterForProvider(provider as CdnProvider);
  if (adapter) return adapter.normalizeCacheState(headers);
  return inferCacheStateFromHeaders(headers, statusCode);
}

function deriveWarmOutcome(
  coldState: NormalizedCacheState,
  warmedState: NormalizedCacheState,
  events: PageWorkingState["warmEvents"],
  explicitOutcome?: WarmOutcome
): WarmOutcome {
  if (explicitOutcome) return explicitOutcome;
  if (warmedState === "HIT") return "warmed-hit";
  if (warmedState === "BYPASS" || coldState === "BYPASS") return "bypass";
  if (warmedState === "DYNAMIC" || coldState === "DYNAMIC") return "uncacheable";
  if (warmedState === "CHALLENGE" || coldState === "CHALLENGE") return "challenged";
  if (warmedState === "ERROR") return "error-response";
  return "remained-miss";
}

export function normalizeCacheOutput(state: PageWorkingState): CacheNormalizerOutput {
  const provider = state.cdnDetector?.provider;
  const coldProbe = state.coldProbe;
  const warmedProbe = state.warmedProbe;

  const cold_state = coldProbe
    ? getState(coldProbe.response_headers, coldProbe.status_code, provider)
    : "UNKNOWN";

  const warmed_state = warmedProbe
    ? getState(warmedProbe.response_headers, warmedProbe.status_code, provider)
    : cold_state;

  // Combine cold probe event with warm events for ratio calculation
  const coldEvent = coldProbe
    ? {
        page_result_id: state.pageId,
        scan_id: state.scanId,
        request_num: 1,
        phase: "cold" as const,
        http_status: coldProbe.status_code,
        latency_ms: coldProbe.latency_ms,
        age_seconds: coldProbe.age_seconds,
        cache_state: cold_state,
        raw_cache_headers: {},
        eligible: cold_state !== "CHALLENGE" && cold_state !== "BYPASS",
      }
    : null;

  const allEvents = [...(coldEvent ? [coldEvent] : []), ...state.warmEvents];
  const ratios = calculateCacheRatios(allEvents);

  const warm_outcome = deriveWarmOutcome(cold_state, warmed_state, state.warmEvents);

  return {
    cold_state,
    warmed_state,
    warm_outcome,
    ...ratios,
  };
}
