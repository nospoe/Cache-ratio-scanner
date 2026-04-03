import type { PageWorkingState, Recommendation } from "../../../types";

export function getPerformanceRecommendations(state: PageWorkingState): Recommendation[] {
  const recs: Recommendation[] = [];
  const metrics = state.browserMetrics;
  if (!metrics) return recs;

  // Slow LCP
  if (metrics.lcp_ms !== null && metrics.lcp_ms > 2500) {
    const severity = metrics.lcp_ms > 4000 ? "critical" : "warning";
    recs.push({
      id: "PERF-001",
      severity,
      category: "performance",
      title: "Slow Largest Contentful Paint (LCP)",
      description: `LCP is ${metrics.lcp_ms}ms. Good LCP should be under 2500ms. This is often driven by slow TTFB, render-blocking resources, or large hero images.`,
      evidence: `LCP: ${metrics.lcp_ms}ms`,
    });
  }

  // Slow TTFB — likely origin latency
  const ttfb = metrics.ttfb_ms ?? state.coldProbe?.ttfb_ms;
  if (ttfb !== null && ttfb !== undefined && ttfb > 600) {
    recs.push({
      id: "PERF-002",
      severity: "warning",
      category: "performance",
      title: "High Time to First Byte (TTFB) — likely origin latency",
      description: `TTFB is ${ttfb}ms. Good TTFB should be under 600ms. High TTFB suggests the origin server is slow to respond. Improve CDN caching to serve from cache instead.`,
      evidence: `TTFB: ${ttfb}ms`,
    });
  }

  // High TBT — render-blocking JS
  if (metrics.tbt_ms !== null && metrics.tbt_ms > 200) {
    const severity = metrics.tbt_ms > 600 ? "critical" : "warning";
    recs.push({
      id: "PERF-003",
      severity,
      category: "performance",
      title: "High Total Blocking Time (TBT)",
      description: `TBT is ${metrics.tbt_ms}ms. High TBT indicates the main thread is blocked by long JavaScript tasks. Split large JS bundles and use code splitting.`,
      evidence: `TBT: ${metrics.tbt_ms}ms`,
    });
  }

  // High CLS
  if (metrics.cls !== null && metrics.cls > 0.1) {
    const severity = metrics.cls > 0.25 ? "critical" : "warning";
    recs.push({
      id: "PERF-004",
      severity,
      category: "performance",
      title: "High Cumulative Layout Shift (CLS)",
      description: `CLS is ${metrics.cls}. Good CLS should be under 0.1. Add explicit size attributes to images and iframes to prevent layout shifts.`,
      evidence: `CLS: ${metrics.cls}`,
    });
  }

  // Render-blocking resources
  if (metrics.render_blocking_resources.length > 0) {
    recs.push({
      id: "PERF-005",
      severity: "warning",
      category: "performance",
      title: "Render-blocking resources detected",
      description: `${metrics.render_blocking_resources.length} render-blocking resource(s) delay the first paint. Use rel="preload", async/defer for scripts, and inline critical CSS.`,
      evidence: metrics.render_blocking_resources.slice(0, 3).join(", "),
    });
  }

  // Large total page weight
  if (metrics.total_bytes > 3_000_000) {
    recs.push({
      id: "PERF-006",
      severity: "warning",
      category: "performance",
      title: "Large total page weight",
      description: `Total transfer size is ${Math.round(metrics.total_bytes / 1024)}KB. Consider compressing images, enabling Brotli/Gzip, and lazy-loading below-the-fold resources.`,
      evidence: `Total bytes: ${metrics.total_bytes}`,
    });
  }

  // High JS weight
  if (metrics.js_bytes > 500_000) {
    recs.push({
      id: "PERF-007",
      severity: "info",
      category: "performance",
      title: "Large JavaScript bundle",
      description: `JS transfer size is ${Math.round(metrics.js_bytes / 1024)}KB. Use code splitting, tree shaking, and lazy loading to reduce JS parse/execution time.`,
      evidence: `JS bytes: ${metrics.js_bytes}`,
    });
  }

  // High third-party count
  if (metrics.third_party_count > 20) {
    recs.push({
      id: "PERF-008",
      severity: "info",
      category: "performance",
      title: "High number of third-party requests",
      description: `${metrics.third_party_count} third-party requests detected. Third-party scripts can block the main thread and add unpredictable latency.`,
      evidence: `Third-party requests: ${metrics.third_party_count}`,
    });
  }

  return recs;
}
