import type { CdnAdapter } from "../../types";
import type { NormalizedCacheState } from "../../../types";
import { getHeader, hasHeader } from "./base";

export const CloudFrontAdapter: CdnAdapter = {
  name: "cloudfront",

  detect(headers: Record<string, string>): boolean {
    return (
      hasHeader(headers, "x-amz-cf-id") ||
      hasHeader(headers, "x-amz-cf-pop") ||
      getHeader(headers, "via")?.toLowerCase().includes("cloudfront") === true ||
      getHeader(headers, "server")?.toLowerCase().includes("cloudfront") === true
    );
  },

  normalizeCacheState(headers: Record<string, string>): NormalizedCacheState {
    // x-cache: Hit from cloudfront / Miss from cloudfront
    const xCache = getHeader(headers, "x-cache")?.toLowerCase();
    if (xCache) {
      if (xCache.includes("hit from cloudfront") || xCache.includes("hit")) return "HIT";
      if (xCache.includes("miss from cloudfront") || xCache.includes("miss")) return "MISS";
      if (xCache.includes("error")) return "ERROR";
    }

    // Fall back on Age header
    const age = getHeader(headers, "age");
    if (age && parseInt(age) > 0) return "HIT";

    return "UNKNOWN";
  },

  extractSignals(headers: Record<string, string>): string[] {
    const signals: string[] = [];
    const cfId = getHeader(headers, "x-amz-cf-id");
    if (cfId) signals.push(`x-amz-cf-id: ${cfId.substring(0, 20)}...`);
    const pop = getHeader(headers, "x-amz-cf-pop");
    if (pop) signals.push(`x-amz-cf-pop: ${pop}`);
    const xCache = getHeader(headers, "x-cache");
    if (xCache) signals.push(`x-cache: ${xCache}`);
    const via = getHeader(headers, "via");
    if (via?.toLowerCase().includes("cloudfront")) signals.push(`via: ${via}`);
    return signals;
  },

  isChallengeResponse(headers: Record<string, string>, body?: string): boolean {
    const status = getHeader(headers, "x-cache");
    if (status?.toLowerCase().includes("error")) return true;
    if (body) {
      const lower = body.toLowerCase();
      if (lower.includes("request blocked") || lower.includes("access denied")) return true;
    }
    return false;
  },

  getConfidenceScore(headers: Record<string, string>): number {
    let score = 0;
    if (hasHeader(headers, "x-amz-cf-id")) score += 0.5;
    if (hasHeader(headers, "x-amz-cf-pop")) score += 0.2;
    if (getHeader(headers, "via")?.toLowerCase().includes("cloudfront")) score += 0.2;
    if (hasHeader(headers, "x-cache")) score += 0.1;
    return Math.min(score, 1.0);
  },
};
