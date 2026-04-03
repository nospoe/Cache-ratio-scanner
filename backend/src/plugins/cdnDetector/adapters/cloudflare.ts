import type { CdnAdapter } from "../../types";
import type { NormalizedCacheState } from "../../../types";
import { getHeader, hasHeader } from "./base";

// CF-Cache-Status values: HIT, MISS, EXPIRED, REVALIDATED, UPDATING, BYPASS, DYNAMIC
const CF_STATUS_MAP: Record<string, NormalizedCacheState> = {
  HIT: "HIT",
  MISS: "MISS",
  EXPIRED: "EXPIRED",
  REVALIDATED: "REVALIDATED",
  UPDATING: "STALE",
  BYPASS: "BYPASS",
  DYNAMIC: "DYNAMIC",
};

export const CloudflareAdapter: CdnAdapter = {
  name: "cloudflare",

  detect(headers: Record<string, string>): boolean {
    return (
      hasHeader(headers, "cf-ray") ||
      hasHeader(headers, "cf-cache-status") ||
      getHeader(headers, "server")?.toLowerCase() === "cloudflare"
    );
  },

  normalizeCacheState(headers: Record<string, string>): NormalizedCacheState {
    // cf-mitigated: challenge means a challenge page is being served
    if (getHeader(headers, "cf-mitigated")?.toLowerCase() === "challenge") {
      return "CHALLENGE";
    }

    const cfStatus = getHeader(headers, "cf-cache-status")?.toUpperCase();
    if (cfStatus && cfStatus in CF_STATUS_MAP) {
      return CF_STATUS_MAP[cfStatus];
    }

    return "UNKNOWN";
  },

  extractSignals(headers: Record<string, string>): string[] {
    const signals: string[] = [];
    const ray = getHeader(headers, "cf-ray");
    if (ray) signals.push(`CF-Ray: ${ray}`);
    const status = getHeader(headers, "cf-cache-status");
    if (status) signals.push(`CF-Cache-Status: ${status}`);
    const mitigated = getHeader(headers, "cf-mitigated");
    if (mitigated) signals.push(`cf-mitigated: ${mitigated}`);
    return signals;
  },

  isChallengeResponse(headers: Record<string, string>, body?: string): boolean {
    if (getHeader(headers, "cf-mitigated")?.toLowerCase() === "challenge") return true;
    if (body) {
      const lower = body.toLowerCase();
      if (
        lower.includes("just a moment") ||
        lower.includes("checking your browser") ||
        lower.includes("enable javascript and cookies") ||
        lower.includes("cloudflare")
      ) {
        return true;
      }
    }
    return false;
  },

  getConfidenceScore(headers: Record<string, string>): number {
    let score = 0;
    if (hasHeader(headers, "cf-ray")) score += 0.5;
    if (hasHeader(headers, "cf-cache-status")) score += 0.4;
    if (getHeader(headers, "server")?.toLowerCase() === "cloudflare") score += 0.1;
    return Math.min(score, 1.0);
  },
};
