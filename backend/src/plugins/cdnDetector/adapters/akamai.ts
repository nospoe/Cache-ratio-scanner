import type { CdnAdapter } from "../../types";
import type { NormalizedCacheState } from "../../../types";
import { getHeader, hasHeader, parseCdnCacheServerTiming } from "./base";

export const AkamaiAdapter: CdnAdapter = {
  name: "akamai",

  detect(headers: Record<string, string>): boolean {
    const server = getHeader(headers, "server")?.toLowerCase() ?? "";
    return (
      hasHeader(headers, "x-akamai-request-id") ||
      hasHeader(headers, "x-akamai-transformed") ||
      hasHeader(headers, "x-akamai-session-info") ||
      hasHeader(headers, "x-check-cacheable") ||
      hasHeader(headers, "x-cache-key") ||
      server.includes("akamaighost") ||
      server.includes("akamai")
    );
  },

  normalizeCacheState(headers: Record<string, string>): NormalizedCacheState {
    // Akamai X-Cache: TCP_HIT, TCP_MISS, TCP_EXPIRED_HIT, etc.
    const xCache = getHeader(headers, "x-cache")?.toUpperCase();
    if (xCache) {
      if (xCache.includes("TCP_HIT") || xCache.includes("TCP_MEM_HIT")) return "HIT";
      if (xCache.includes("TCP_EXPIRED_HIT")) return "EXPIRED";
      if (xCache.includes("TCP_EXPIRED_MISS")) return "EXPIRED";
      if (xCache.includes("TCP_MISS")) return "MISS";
      if (xCache.includes("TCP_REFRESH_HIT")) return "REVALIDATED";
      if (xCache.includes("TCP_DENIED")) return "BYPASS";
      if (xCache.includes("TCP_ERROR")) return "ERROR";
    }

    // x-check-cacheable
    const checkCacheable = getHeader(headers, "x-check-cacheable")?.toUpperCase();
    if (checkCacheable === "YES") return "MISS"; // cacheable but not yet cached
    if (checkCacheable === "NO") return "BYPASS";

    // server-timing: cdn-cache; desc=HIT|MISS — most explicit, check first
    const serverTiming = getHeader(headers, "server-timing");
    if (serverTiming) {
      const cdnCache = parseCdnCacheServerTiming(serverTiming);
      if (cdnCache) return cdnCache;
    }

    // x-cache-hits: any non-zero tier value = HIT (only promote HITs, not MISSes)
    const xCacheHits = getHeader(headers, "x-cache-hits");
    if (xCacheHits) {
      const hits = xCacheHits.split(",").map((v) => parseInt(v.trim(), 10));
      if (hits.some((h) => h > 0)) return "HIT";
    }

    // Akamai pragma diagnostics (X-Cache-Key present = Akamai served this)
    const age = getHeader(headers, "age");
    if (hasHeader(headers, "x-cache-key") && age && parseInt(age) > 0) return "HIT";

    return "UNKNOWN";
  },

  extractSignals(headers: Record<string, string>): string[] {
    const signals: string[] = [];
    const requestId = getHeader(headers, "x-akamai-request-id");
    if (requestId) signals.push(`x-akamai-request-id: ${requestId.substring(0, 16)}...`);
    const xCache = getHeader(headers, "x-cache");
    if (xCache) signals.push(`x-cache: ${xCache}`);
    const cacheKey = getHeader(headers, "x-cache-key");
    if (cacheKey) signals.push(`x-cache-key present`);
    const server = getHeader(headers, "server");
    if (server?.toLowerCase().includes("akamai")) signals.push(`server: ${server}`);
    return signals;
  },

  isChallengeResponse(headers: Record<string, string>, body?: string): boolean {
    if (body) {
      const lower = body.toLowerCase();
      if (lower.includes("access denied") || lower.includes("reference #")) return true;
    }
    return false;
  },

  getConfidenceScore(headers: Record<string, string>): number {
    let score = 0;
    if (hasHeader(headers, "x-akamai-request-id")) score += 0.5;
    if (hasHeader(headers, "x-cache-key")) score += 0.2;
    if (getHeader(headers, "server")?.toLowerCase().includes("akamai")) score += 0.2;
    if (hasHeader(headers, "x-check-cacheable")) score += 0.1;
    return Math.min(score, 1.0);
  },
};
