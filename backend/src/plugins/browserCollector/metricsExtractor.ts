/* eslint-disable @typescript-eslint/no-explicit-any */
import type { BrowserMetrics, WaterfallEntry } from "../../types";
import type { Browser } from "playwright";

const DESKTOP_VIEWPORT = { width: 1280, height: 800 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const MOBILE_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

export interface BrowserOptions {
  deviceProfile: "desktop" | "mobile" | "custom";
  customViewport?: { width: number; height: number };
  customUserAgent?: string;
  timeoutMs?: number;
}

export async function collectBrowserMetrics(
  browser: Browser,
  url: string,
  options: BrowserOptions
): Promise<BrowserMetrics> {
  const { deviceProfile, customViewport, customUserAgent, timeoutMs = 30000 } = options;
  const viewport =
    deviceProfile === "mobile"
      ? MOBILE_VIEWPORT
      : customViewport ?? DESKTOP_VIEWPORT;
  const userAgent =
    deviceProfile === "mobile"
      ? MOBILE_USER_AGENT
      : customUserAgent ?? "";

  const context = await browser.newContext({
    viewport,
    userAgent: userAgent || undefined,
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();
  const waterfall: WaterfallEntry[] = [];
  const requestStartTimes = new Map<string, number>();

  page.on("request", (req) => {
    requestStartTimes.set(req.url(), performance.now());
  });

  page.on("response", async (resp) => {
    const reqUrl = resp.url();
    const start = requestStartTimes.get(reqUrl) ?? 0;
    const duration = Math.round(performance.now() - start);
    let size = 0;
    try {
      const body = await resp.body();
      size = body.length;
    } catch {
      // ignore
    }

    let pageOrigin = "";
    try { pageOrigin = new URL(url).origin; } catch { /* ok */ }
    let reqOrigin = "";
    try { reqOrigin = new URL(reqUrl).origin; } catch { /* ok */ }

    waterfall.push({
      url: reqUrl,
      type: resp.request().resourceType(),
      start_ms: Math.round(start),
      duration_ms: duration,
      size_bytes: size,
      is_third_party: reqOrigin !== pageOrigin,
      is_render_blocking: false,
      status_code: resp.status(),
    });
  });

  try {
    // Inject PerformanceObserver before navigation — runs in browser context.
    // Types are intentionally `any` here because this code executes in the
    // browser, not in Node, and DOM lib is not included in tsconfig.
    await page.addInitScript(() => {
      const w = globalThis as any;
      w.__perf = { lcp: null as number | null, cls: 0, longTasksMs: 0, longTasks: [] as number[] };
      const perf = w.__perf;

      try {
        new (w.PerformanceObserver)((list: any) => {
          const entries = list.getEntries();
          if (entries.length) perf.lcp = entries[entries.length - 1].startTime;
        }).observe({ type: "largest-contentful-paint", buffered: true });

        new (w.PerformanceObserver)((list: any) => {
          for (const e of list.getEntries()) {
            if (!e.hadRecentInput) perf.cls += e.value ?? 0;
          }
        }).observe({ type: "layout-shift", buffered: true });

        new (w.PerformanceObserver)((list: any) => {
          for (const e of list.getEntries()) {
            perf.longTasksMs += e.duration;
            perf.longTasks.push(e.duration);
          }
        }).observe({ type: "longtask", buffered: true });
      } catch {
        // PerformanceObserver not available
      }
    });

    const navigationStart = performance.now();

    await page.goto(url, { timeout: timeoutMs, waitUntil: "networkidle" });

    const fullyLoadedMs = Math.round(performance.now() - navigationStart);

    // Collect Navigation Timing
    const navTiming = await page.evaluate(() => {
      const nav = (performance as any).getEntriesByType("navigation")[0] as any;
      if (!nav) return null;
      return {
        ttfb: nav.responseStart - nav.requestStart,
        domContentLoaded: nav.domContentLoadedEventEnd - nav.startTime,
      };
    });

    // FCP from paint entries
    const paintEntries = await page.evaluate(() => {
      const entries = (performance as any).getEntriesByType("paint") as any[];
      const fcp = entries.find((e: any) => e.name === "first-contentful-paint");
      return { fcp: fcp?.startTime ?? null };
    });

    // Custom PerformanceObserver data
    const customPerf = await page.evaluate(() => {
      return (globalThis as any).__perf as {
        lcp: number | null;
        cls: number;
        longTasksMs: number;
        longTasks: number[];
      } | undefined;
    });

    // Resource byte breakdown
    const resourceSummary = await page.evaluate(() => {
      const resources = (performance as any).getEntriesByType("resource") as any[];
      let jsBytes = 0, cssBytes = 0, imageBytes = 0, fontBytes = 0;
      for (const r of resources) {
        const size = r.transferSize || 0;
        if (r.initiatorType === "script") jsBytes += size;
        else if (r.initiatorType === "css" || r.initiatorType === "link") cssBytes += size;
        else if (r.initiatorType === "img" || r.initiatorType === "image") imageBytes += size;
        else if (r.initiatorType === "font") fontBytes += size;
      }
      return { jsBytes, cssBytes, imageBytes, fontBytes };
    });

    // Render-blocking resources
    const renderBlocking: string[] = await page.evaluate(() => {
      const urls: string[] = [];
      const resources = (performance as any).getEntriesByType("resource") as any[];
      for (const r of resources) {
        if (r.renderBlockingStatus === "blocking") urls.push(r.name);
      }
      return urls;
    }).catch(() => [] as string[]);

    for (const entry of waterfall) {
      if (renderBlocking.includes(entry.url)) entry.is_render_blocking = true;
    }

    const ttfbMs = navTiming ? Math.round(navTiming.ttfb) : null;
    const fcpMs = paintEntries.fcp ? Math.round(paintEntries.fcp) : null;
    const lcpMs = customPerf?.lcp ? Math.round(customPerf.lcp) : null;
    const cls = customPerf ? Math.round(customPerf.cls * 1000) / 1000 : null;
    const tbtMs = customPerf
      ? Math.round(customPerf.longTasks.reduce((acc, t) => acc + Math.max(0, t - 50), 0))
      : null;
    const speedIndex = lcpMs ?? fcpMs;
    const perfScore = computePerformanceScore({ fcp: fcpMs, lcp: lcpMs, tbt: tbtMs, cls });
    const totalBytes = waterfall.reduce((acc, e) => acc + e.size_bytes, 0);

    return {
      fcp_ms: fcpMs,
      lcp_ms: lcpMs,
      cls,
      tbt_ms: tbtMs,
      speed_index: speedIndex,
      ttfb_ms: ttfbMs,
      fully_loaded_ms: fullyLoadedMs,
      dom_content_loaded_ms: navTiming ? Math.round(navTiming.domContentLoaded) : null,
      total_requests: waterfall.length,
      total_bytes: totalBytes,
      js_bytes: resourceSummary.jsBytes,
      css_bytes: resourceSummary.cssBytes,
      image_bytes: resourceSummary.imageBytes,
      font_bytes: resourceSummary.fontBytes,
      third_party_count: waterfall.filter((e) => e.is_third_party).length,
      render_blocking_resources: renderBlocking,
      waterfall,
      performance_score: perfScore,
      long_tasks_total_ms: customPerf?.longTasksMs ? Math.round(customPerf.longTasksMs) : 0,
    };
  } finally {
    await context.close();
  }
}

function computePerformanceScore(m: {
  fcp: number | null;
  lcp: number | null;
  tbt: number | null;
  cls: number | null;
}): number {
  let score = 100;
  if (m.lcp != null) score -= m.lcp > 4000 ? 25 : m.lcp > 2500 ? 12 : 0;
  if (m.fcp != null) score -= m.fcp > 3000 ? 10 : m.fcp > 1800 ? 5 : 0;
  if (m.tbt != null) score -= m.tbt > 600 ? 30 : m.tbt > 200 ? 15 : 0;
  if (m.cls != null) score -= m.cls > 0.25 ? 15 : m.cls > 0.1 ? 7 : 0;
  return Math.max(0, Math.min(100, score));
}
