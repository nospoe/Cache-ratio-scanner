import type { CdnAdapter } from "../../types";
import type { NormalizedCacheState } from "../../../types";
import { getHeader, hasHeader, parseCdnCacheServerTiming } from "./base";

export const FastlyAdapter: CdnAdapter = {
  name: "fastly",

  detect(headers: Record<string, string>): boolean {
    return (
      hasHeader(headers, "x-served-by") ||
      hasHeader(headers, "x-timer") ||
      getHeader(headers, "via")?.toLowerCase().includes("varnish") === true ||
      getHeader(headers, "x-fastly-request-id") !== undefined
    );
  },

  normalizeCacheState(headers: Record<string, string>): NormalizedCacheState {
    // x-cache: HIT, MISS, or combinations like "HIT, HIT"
    const xCache = getHeader(headers, "x-cache")?.toUpperCase();
    if (xCache) {
      if (xCache.includes("HIT")) return "HIT";
      if (xCache.includes("MISS")) return "MISS";
      if (xCache.includes("PASS")) return "BYPASS";
      if (xCache.includes("SYNTH")) return "DYNAMIC";
      if (xCache.includes("ERROR")) return "ERROR";
    }

    // server-timing: cdn-cache; desc=HIT|MISS|PASS — most explicit, check first
    const serverTiming = getHeader(headers, "server-timing");
    if (serverTiming) {
      const cdnCache = parseCdnCacheServerTiming(serverTiming);
      if (cdnCache) return cdnCache;
    }

    // x-cache-hits: comma-separated per-tier hit counts (e.g. "0, 1, 0")
    // Only use for HIT — a single "0" on one edge node can coexist with a mid-tier HIT
    // already declared by server-timing above, so only promote HITs here
    const xCacheHits = getHeader(headers, "x-cache-hits");
    if (xCacheHits) {
      const hits = xCacheHits.split(",").map((v) => parseInt(v.trim(), 10));
      if (hits.some((h) => h > 0)) return "HIT";
    }

    // Age > 0 suggests served from cache
    const age = getHeader(headers, "age");
    if (age && parseInt(age) > 0) return "HIT";

    return "UNKNOWN";
  },

  extractSignals(headers: Record<string, string>): string[] {
    const signals: string[] = [];
    const servedBy = getHeader(headers, "x-served-by");
    if (servedBy) signals.push(`x-served-by: ${servedBy}`);
    const xCache = getHeader(headers, "x-cache");
    if (xCache) signals.push(`x-cache: ${xCache}`);
    const xTimer = getHeader(headers, "x-timer");
    if (xTimer) signals.push(`x-timer: ${xTimer}`);
    const fastlyId = getHeader(headers, "x-fastly-request-id");
    if (fastlyId) signals.push(`x-fastly-request-id present`);
    return signals;
  },

  isChallengeResponse(headers: Record<string, string>, body?: string): boolean {
    if (body) {
      const lower = body.toLowerCase();
      if (lower.includes("attention required") || lower.includes("fastly error")) return true;
    }
    return false;
  },

  getConfidenceScore(headers: Record<string, string>): number {
    let score = 0;
    if (hasHeader(headers, "x-served-by")) score += 0.35;
    if (hasHeader(headers, "x-timer")) score += 0.35;
    if (hasHeader(headers, "x-fastly-request-id")) score += 0.2;
    if (hasHeader(headers, "x-cache")) score += 0.1;
    return Math.min(score, 1.0);
  },
};
