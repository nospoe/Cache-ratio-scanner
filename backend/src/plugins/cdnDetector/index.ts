import type { CdnDetectorOutput, CdnProvider, CdnConfidence } from "../../types";
import type { CdnAdapter } from "../types";
import { CloudflareAdapter } from "./adapters/cloudflare";
import { CloudFrontAdapter } from "./adapters/cloudfront";
import { FastlyAdapter } from "./adapters/fastly";
import { AkamaiAdapter } from "./adapters/akamai";
import { detectUnknownCdn } from "./fallback";

// Priority-ordered adapter registry
// Cloudflare first since CF-Ray is unambiguous
const ADAPTERS: CdnAdapter[] = [
  CloudflareAdapter,
  CloudFrontAdapter,
  FastlyAdapter,
  AkamaiAdapter,
];

function scoreToConfidence(score: number): CdnConfidence {
  if (score >= 0.7) return "high";
  if (score >= 0.4) return "medium";
  if (score >= 0.2) return "low";
  return "none";
}

export function detectCdn(
  headers: Record<string, string>
): CdnDetectorOutput & { adapter: CdnAdapter | null } {
  for (const adapter of ADAPTERS) {
    if (adapter.detect(headers)) {
      const score = adapter.getConfidenceScore(headers);
      const signals = adapter.extractSignals(headers);
      return {
        provider: adapter.name,
        confidence: scoreToConfidence(score),
        confidenceScore: score,
        signals,
        adapter,
      };
    }
  }

  // No known CDN matched — run fallback heuristics
  const fallback = detectUnknownCdn(headers);
  return {
    provider: "unknown" as CdnProvider,
    confidence: "none",
    confidenceScore: fallback.confidence,
    signals: fallback.signals,
    adapter: null,
  };
}

export function getAdapterForProvider(provider: CdnProvider): CdnAdapter | null {
  return ADAPTERS.find((a) => a.name === provider) ?? null;
}
