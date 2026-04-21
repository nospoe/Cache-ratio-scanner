import type { NormalizedCacheState } from "../../types";
import { getHeader, hasHeader, parseCdnCacheServerTiming } from "./adapters/base";

// Heuristic CDN detection when no known CDN is matched
export function detectUnknownCdn(headers: Record<string, string>): {
  likelyCdn: boolean;
  confidence: number;
  signals: string[];
} {
  const signals: string[] = [];
  let score = 0;

  // Via header presence suggests a proxy/CDN
  const via = getHeader(headers, "via");
  if (via) {
    score += 0.2;
    signals.push(`via: ${via}`);
  }

  // X-Cache is commonly used by many CDNs and Varnish
  const xCache = getHeader(headers, "x-cache");
  if (xCache) {
    score += 0.3;
    signals.push(`x-cache: ${xCache}`);
  }

  // Age > 0 suggests object was served from a cache
  const age = getHeader(headers, "age");
  if (age && parseInt(age) > 0) {
    score += 0.2;
    signals.push(`age: ${age}`);
  }

  // CDN-specific but unknown vendor headers
  if (hasHeader(headers, "x-cdn")) {
    score += 0.1;
    signals.push("x-cdn header present");
  }
  if (hasHeader(headers, "x-edge-ip")) {
    score += 0.1;
    signals.push("x-edge-ip header present");
  }
  if (hasHeader(headers, "x-pull")) {
    score += 0.05;
    signals.push("x-pull header present");
  }

  // Cache-Control with public/s-maxage signals a cacheable origin
  const cc = getHeader(headers, "cache-control");
  if (cc) {
    if (cc.includes("s-maxage") || cc.includes("public")) {
      score += 0.05;
      signals.push(`cache-control: ${cc}`);
    }
  }

  return {
    likelyCdn: score >= 0.3,
    confidence: Math.min(score, 0.49), // cap at 0.49 to signal uncertain
    signals,
  };
}

// Infer cache state from standard HTTP headers when CDN is unknown
export function inferCacheStateFromHeaders(
  headers: Record<string, string>,
  statusCode: number
): NormalizedCacheState {
  // x-cache heuristic
  const xCache = getHeader(headers, "x-cache")?.toUpperCase();
  if (xCache) {
    if (xCache.includes("HIT")) return "HIT";
    if (xCache.includes("MISS")) return "MISS";
    if (xCache.includes("BYPASS") || xCache.includes("PASS")) return "BYPASS";
  }

  // server-timing: cdn-cache; desc=HIT|MISS|PASS — most explicit, check first
  const serverTiming = getHeader(headers, "server-timing");
  if (serverTiming) {
    const cdnCache = parseCdnCacheServerTiming(serverTiming);
    if (cdnCache) return cdnCache;
  }

  // x-cache-hits: any non-zero tier = HIT (only promote HITs, not MISSes)
  const xCacheHits = getHeader(headers, "x-cache-hits");
  if (xCacheHits) {
    const hits = xCacheHits.split(",").map((v) => parseInt(v.trim(), 10));
    if (hits.some((h) => h > 0)) return "HIT";
  }

  const cc = getHeader(headers, "cache-control")?.toLowerCase();
  const age = getHeader(headers, "age");

  // No-cache / no-store = not cached
  if (cc?.includes("no-store") || cc?.includes("no-cache")) return "DYNAMIC";

  // Private = not sharable
  if (cc?.includes("private")) return "DYNAMIC";

  // Age > 0 = object was in a shared cache
  if (age && parseInt(age) > 0) return "HIT";

  // Error statuses
  if (statusCode >= 500) return "ERROR";

  // Response is cacheable but we have no CDN hit/miss signals — we genuinely
  // don't know whether it was served from cache. Return UNKNOWN rather than
  // inferring MISS; a CDN adapter (if matched) would give a more precise answer.
  return "UNKNOWN";
}
