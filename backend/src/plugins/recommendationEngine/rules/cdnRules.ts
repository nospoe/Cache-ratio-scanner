import type { PageWorkingState, Recommendation } from "../../../types";
import { getHeader } from "../../cdnDetector/adapters/base";

export function getCdnRecommendations(state: PageWorkingState): Recommendation[] {
  const recs: Recommendation[] = [];
  const probe = state.warmedProbe ?? state.coldProbe;
  if (!probe) return recs;

  const headers = probe.response_headers;
  const cdnProvider = state.cdnDetector?.provider;
  const cacheHitRatio = state.cacheNormalizer?.cache_hit_ratio ?? 0;

  // Unknown CDN with low confidence
  if (cdnProvider === "unknown" && (state.cdnDetector?.confidenceScore ?? 0) < 0.3) {
    recs.push({
      id: "CDN-001",
      severity: "info",
      category: "cdn",
      title: "CDN not detected or confidence is low",
      description:
        "No known CDN was detected from response headers. If a CDN is in use, ensure CDN-specific headers are exposed. If not using a CDN, consider adding one to improve performance and availability.",
      evidence: `Confidence score: ${state.cdnDetector?.confidenceScore?.toFixed(2) ?? 0}`,
    });
  }

  // Forwarded cookies reducing cache efficiency
  const cookieHeader = getHeader(headers, "set-cookie");
  if (cookieHeader && cacheHitRatio < 0.5) {
    recs.push({
      id: "CDN-002",
      severity: "warning",
      category: "cdn",
      title: "Cookies likely reducing CDN cache hit ratio",
      description:
        "Set-Cookie headers on this response are likely reducing CDN cache effectiveness. CloudFront explicitly notes that forwarding unnecessary headers/cookies reduces cache hit ratio. Use a dedicated cookie domain or strip session cookies at the CDN.",
      evidence: `Cache hit ratio: ${(cacheHitRatio * 100).toFixed(0)}%`,
    });
  }

  // Vary header with multiple fields
  const vary = getHeader(headers, "vary");
  if (vary && vary.split(",").length > 2) {
    recs.push({
      id: "CDN-003",
      severity: "warning",
      category: "cdn",
      title: "Vary header with many fields fragments CDN cache",
      description: `The Vary header contains multiple fields (${vary}), which fragments the CDN cache into many variants. CDN cache hit ratios drop significantly with broad Vary headers. Reduce to Vary: Accept-Encoding where possible.`,
      evidence: `Vary: ${vary}`,
    });
  }

  // Challenge/block page
  if (state.challengeDetector?.is_challenged) {
    recs.push({
      id: "CDN-004",
      severity: "critical",
      category: "cdn",
      title: "Challenge or block page detected",
      description: `This page returned what appears to be a ${state.challengeDetector.challenge_type ?? "challenge"} page. Signals: ${state.challengeDetector.signals.slice(0, 3).join("; ")}. Investigate whether legitimate traffic is being blocked.`,
      evidence: `Confidence: ${(state.challengeDetector.confidence * 100).toFixed(0)}%`,
    });
  }

  // HTTPS not enforced (HTTP response)
  if (probe.final_url.startsWith("http://")) {
    recs.push({
      id: "CDN-005",
      severity: "warning",
      category: "cdn",
      title: "Response served over HTTP (not HTTPS)",
      description:
        "The final URL is served over plain HTTP. Enable HTTPS and configure the CDN to redirect HTTP to HTTPS for all requests.",
      evidence: `Final URL: ${probe.final_url}`,
    });
  }

  return recs;
}
