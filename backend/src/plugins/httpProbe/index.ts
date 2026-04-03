import { runProbe, type ProbeOptions } from "./probeRunner";
import { warmCache } from "./warmingStrategy";
import { detectCdn } from "../cdnDetector";
import type { PageWorkingState } from "../../types";
import { childLogger } from "../../utils/logger";

const log = childLogger("httpProbe");

export async function runHttpProbePhase(
  state: PageWorkingState,
  probeOptions: ProbeOptions = {}
): Promise<PageWorkingState> {
  const { url, scanId, pageId, settings } = state;

  // Step A: Cold probe
  log.debug({ url, scanId }, "Cold probe");
  const coldProbe = await runProbe(url, {
    timeoutMs: settings.requestTimeoutMs,
    maxRedirects: settings.maxRedirects,
    headers: settings.headers,
    validateSsrf: process.env.SSRF_PROTECTION !== "false",
    ...probeOptions,
  });

  if (coldProbe.error && !coldProbe.status_code) {
    return { ...state, coldProbe, error: coldProbe.error };
  }

  // Detect CDN from cold probe headers
  const cdnResult = detectCdn(coldProbe.response_headers);

  // Step B: Warm cache
  log.debug({ url, scanId, provider: cdnResult.provider }, "Starting cache warming");
  const warmResult = await warmCache(
    coldProbe.final_url || url,
    scanId,
    pageId,
    cdnResult.provider,
    cdnResult.adapter,
    coldProbe,
    {
      maxAttempts: settings.maxWarmAttempts,
      delayMs: settings.warmDelayMs,
      probeOptions: {
        timeoutMs: settings.requestTimeoutMs,
        maxRedirects: settings.maxRedirects,
        headers: settings.headers,
        validateSsrf: process.env.SSRF_PROTECTION !== "false",
        ...probeOptions,
      },
    }
  );

  log.debug({ url, scanId, warmOutcome: warmResult.warmOutcome }, "Cache warming complete");

  return {
    ...state,
    coldProbe,
    warmEvents: warmResult.warmEvents,
    warmedProbe: warmResult.warmedProbe,
    cdnDetector: {
      provider: cdnResult.provider,
      confidence: cdnResult.confidence,
      confidenceScore: cdnResult.confidenceScore,
      signals: cdnResult.signals,
    },
  };
}
