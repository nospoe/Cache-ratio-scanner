import { v4 as uuidv4 } from "uuid";
import type { PageWorkingState, ScanSettings } from "../types";
import { runHttpProbePhase } from "../plugins/httpProbe";
import { normalizeCacheOutput } from "../plugins/cacheNormalizer";
import { runChallengeDetection } from "../plugins/challengeDetector";
import { runBrowserCollection } from "../plugins/browserCollector";
import { generateRecommendations } from "../plugins/recommendationEngine";
import { createPageResult, updatePageResult, updatePageStatus } from "../db/repositories/pageRepo";
import { insertCacheEvents } from "../db/repositories/cacheEventRepo";
import { childLogger } from "../utils/logger";

const log = childLogger("scanOrchestrator");

export async function orchestratePage(
  url: string,
  depth: number,
  scanId: string,
  settings: ScanSettings
): Promise<PageWorkingState> {
  const pageId = uuidv4();

  log.info({ pageId, url, scanId }, "Orchestrating page scan");

  // Create pending DB row
  await createPageResult({ id: pageId, scan_id: scanId, original_url: url, crawl_depth: depth });

  // Initialize working state
  let state: PageWorkingState = {
    url,
    crawlDepth: depth,
    scanId,
    pageId,
    settings,
    warmEvents: [],
    recommendations: [],
  };

  // Mark as running
  await updatePageStatus(pageId, "running");

  try {
    // Phase 1: HTTP probe + CDN detection + cache warming
    if (settings.scanCache || settings.scanPerformance) {
      state = await runHttpProbePhase(state);
      if (state.error && !state.coldProbe?.status_code) {
        // Fatal connection error
        await persistPage(state);
        return state;
      }
    }

    // Phase 2: Challenge detection (from HTTP probe results)
    state = runChallengeDetection(state);

    // Phase 3: Cache normalization + ratio calculation
    if (settings.scanCache && state.coldProbe) {
      const cacheOutput = normalizeCacheOutput(state);
      state = { ...state, cacheNormalizer: cacheOutput };
    }

    // Phase 4: Browser performance collection
    if (settings.scanPerformance) {
      state = await runBrowserCollection(state);
    }

    // Phase 5: Recommendations
    state = generateRecommendations(state);

    log.info({ pageId, url, warmOutcome: state.cacheNormalizer?.warm_outcome }, "Page scan complete");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ pageId, url, err: msg }, "Page scan failed");
    state = { ...state, error: msg };
  }

  // Persist to DB
  await persistPage(state);

  return state;
}

async function persistPage(state: PageWorkingState): Promise<void> {
  try {
    await updatePageResult(state.pageId, state);

    // Insert cache events
    if (state.warmEvents.length > 0) {
      const eventsWithPageId = state.warmEvents.map((e) => ({
        ...e,
        page_result_id: state.pageId,
      }));
      await insertCacheEvents(eventsWithPageId);
    }

    // Insert cold probe as cache event
    if (state.coldProbe) {
      // Use the existing cache state from the normalizer
      const coldState = state.cacheNormalizer?.cold_state ?? "UNKNOWN";
      await insertCacheEvents([{
        page_result_id: state.pageId,
        scan_id: state.scanId,
        request_num: 1,
        phase: "cold",
        http_status: state.coldProbe.status_code,
        latency_ms: state.coldProbe.latency_ms,
        age_seconds: state.coldProbe.age_seconds,
        cache_state: coldState,
        raw_cache_headers: {},
        eligible: coldState !== "CHALLENGE" && coldState !== "BYPASS",
      }]);
    }
  } catch (err) {
    log.error({ pageId: state.pageId, err }, "Failed to persist page result");
  }
}
