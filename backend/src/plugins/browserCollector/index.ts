import { chromium } from "playwright";
import { collectBrowserMetrics } from "./metricsExtractor";
import type { BrowserMetrics, PageWorkingState } from "../../types";
import { childLogger } from "../../utils/logger";

const log = childLogger("browserCollector");

export async function runBrowserCollection(
  state: PageWorkingState
): Promise<PageWorkingState> {
  const { settings, pageId } = state;

  // Skip browser collection if page is challenged or blocked
  if (
    state.challengeDetector?.is_challenged ||
    state.challengeDetector?.is_blocked
  ) {
    log.debug({ pageId }, "Skipping browser collection: challenged/blocked page");
    return state;
  }

  // Use warmed URL if available
  const url = state.warmedProbe?.final_url || state.coldProbe?.final_url || state.url;

  log.debug({ pageId, url }, "Starting browser collection");

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-extensions",
      ],
    });

    const metrics = await collectBrowserMetrics(browser, url, {
      deviceProfile: settings.deviceProfile,
      customViewport: settings.customViewport,
      customUserAgent: settings.customUserAgent,
      timeoutMs: settings.browserTimeoutMs,
    });

    log.debug(
      { pageId, lcp: metrics.lcp_ms, fcp: metrics.fcp_ms, score: metrics.performance_score },
      "Browser collection complete"
    );

    return { ...state, browserMetrics: metrics };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn({ pageId, url, err: msg }, "Browser collection failed");
    // Don't fail the whole page scan — just mark metrics as null
    return { ...state, browserMetrics: undefined };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
