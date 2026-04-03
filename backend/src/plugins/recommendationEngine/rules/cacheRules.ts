import type { PageWorkingState, Recommendation } from "../../../types";
import { getHeader } from "../../cdnDetector/adapters/base";

export function getCacheRecommendations(state: PageWorkingState): Recommendation[] {
  const recs: Recommendation[] = [];
  const probe = state.warmedProbe ?? state.coldProbe;
  if (!probe) return recs;

  const headers = probe.response_headers;
  const cc = getHeader(headers, "cache-control")?.toLowerCase() ?? "";
  const sMaxAge = extractSMaxAge(cc);
  const maxAge = extractMaxAge(cc);
  const age = probe.age_seconds;
  const warmOutcome = state.cacheNormalizer?.warm_outcome;
  const warmEvents = state.warmEvents;
  const contentType = probe.content_type?.toLowerCase() ?? "";

  // HTML not cached despite public + s-maxage
  if (
    contentType.includes("html") &&
    (cc.includes("public") || cc.includes("s-maxage")) &&
    warmOutcome !== "warmed-hit" &&
    warmOutcome !== "bypass"
  ) {
    recs.push({
      id: "CACHE-001",
      severity: "warning",
      category: "cache",
      title: "HTML document not being cached by CDN",
      description:
        "The response includes public caching directives but the CDN did not serve a HIT. Check for cache-busting headers like Set-Cookie or Vary: * that prevent CDN caching.",
      evidence: `Cache-Control: ${cc}, warm outcome: ${warmOutcome}`,
    });
  }

  // No cache-control on HTML
  if (contentType.includes("html") && !cc) {
    recs.push({
      id: "CACHE-002",
      severity: "warning",
      category: "cache",
      title: "HTML document missing Cache-Control header",
      description:
        "Without a Cache-Control header, CDN behavior is undefined. Add explicit Cache-Control directives (e.g., public, s-maxage=300, stale-while-revalidate=60).",
      evidence: "Cache-Control header absent",
    });
  }

  // CDN hit only after many warm attempts
  const warmAttempts = warmEvents.filter((e) => e.phase === "warm").length;
  if (warmAttempts > 3 && warmOutcome === "warmed-hit") {
    recs.push({
      id: "CACHE-003",
      severity: "info",
      category: "cache",
      title: "CDN cache took multiple requests to warm",
      description: `Cache HIT was only achieved after ${warmAttempts} warm requests. This may indicate slow cache propagation across PoPs or a high TTL causing infrequent repopulation.`,
      evidence: `Warm attempts before HIT: ${warmAttempts}`,
    });
  }

  // Error page that is cached
  if (probe.status_code >= 400 && state.cacheNormalizer?.warmed_state === "HIT") {
    recs.push({
      id: "CACHE-004",
      severity: "critical",
      category: "cache",
      title: "Error page is being cached",
      description: `A ${probe.status_code} response is being served from cache. This can cause widespread visibility of errors after the issue is resolved. Add Cache-Control: no-store on error responses.`,
      evidence: `Status: ${probe.status_code}, cache state: HIT`,
    });
  }

  // Very low s-maxage
  if (sMaxAge !== null && sMaxAge < 60 && sMaxAge > 0) {
    recs.push({
      id: "CACHE-005",
      severity: "info",
      category: "cache",
      title: "Very short CDN TTL",
      description: `s-maxage is set to ${sMaxAge}s. Very short TTLs increase origin load and reduce CDN effectiveness. Consider increasing to at least 300s for cacheable content.`,
      evidence: `s-maxage=${sMaxAge}`,
    });
  }

  // Vary: * kills caching
  const vary = getHeader(headers, "vary");
  if (vary?.includes("*")) {
    recs.push({
      id: "CACHE-006",
      severity: "critical",
      category: "cache",
      title: "Vary: * prevents all caching",
      description:
        "A Vary: * header prevents any shared cache from storing this response. Remove it or use specific Vary directives like Vary: Accept-Encoding.",
      evidence: `Vary: ${vary}`,
    });
  }

  // Set-Cookie on cacheable HTML
  if (
    getHeader(headers, "set-cookie") &&
    (cc.includes("public") || cc.includes("s-maxage"))
  ) {
    recs.push({
      id: "CACHE-007",
      severity: "warning",
      category: "cache",
      title: "Set-Cookie on public/cacheable response",
      description:
        "The response sends a cookie while also declaring public cacheability. Most CDNs will bypass cache for responses with Set-Cookie. Use a separate cookie domain or strip the cookie at the CDN edge.",
      evidence: "Set-Cookie + public/s-maxage combination",
    });
  }

  // Stale-while-revalidate missing
  if (sMaxAge !== null && sMaxAge > 0 && !cc.includes("stale-while-revalidate")) {
    recs.push({
      id: "CACHE-008",
      severity: "info",
      category: "cache",
      title: "Consider adding stale-while-revalidate",
      description:
        "Adding stale-while-revalidate=60 allows CDN to serve slightly stale content while revalidating in the background, improving availability during TTL expiry.",
      evidence: `Cache-Control: ${cc}`,
    });
  }

  return recs;
}

function extractSMaxAge(cc: string): number | null {
  const match = cc.match(/s-maxage=(\d+)/);
  return match ? parseInt(match[1]) : null;
}

function extractMaxAge(cc: string): number | null {
  const match = cc.match(/(?:^|,\s*)max-age=(\d+)/);
  return match ? parseInt(match[1]) : null;
}
