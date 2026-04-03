import type { ChallengeType } from "../../types";
import { getHeader, hasHeader } from "../cdnDetector/adapters/base";

export interface HeuristicResult {
  is_challenged: boolean;
  is_blocked: boolean;
  challenge_type: ChallengeType | null;
  confidence: number;
  signals: string[];
  score: number;
}

const CHALLENGE_THRESHOLD = 5;
const BLOCK_THRESHOLD = 4;

export function runHeuristics(
  statusCode: number,
  responseHeaders: Record<string, string>,
  contentType: string | null,
  body?: string,
  expectedContentType?: string
): HeuristicResult {
  let score = 0;
  const signals: string[] = [];

  // Status code signals
  if (statusCode === 403) {
    score += 2;
    signals.push("HTTP 403 Forbidden");
  } else if (statusCode === 429) {
    score += 2;
    signals.push("HTTP 429 Too Many Requests");
  } else if (statusCode === 503) {
    score += 1;
    signals.push("HTTP 503 Service Unavailable");
  } else if (statusCode >= 400 && statusCode < 500) {
    score += 1;
    signals.push(`HTTP ${statusCode}`);
  }

  // Retry-After header (rate limit signal)
  if (hasHeader(responseHeaders, "retry-after")) {
    score += 1;
    signals.push("Retry-After header present");
  }

  // Cloudflare challenge
  if (getHeader(responseHeaders, "cf-mitigated")?.toLowerCase() === "challenge") {
    score += 5;
    signals.push("cf-mitigated: challenge");
  }

  // Content-type mismatch (resource returns HTML when JSON/image expected)
  const ct = contentType?.toLowerCase();
  const expectedCt = expectedContentType?.toLowerCase();
  if (ct && expectedCt && ct.includes("html") && !expectedCt.includes("html")) {
    score += 2;
    signals.push(`Content-type mismatch: got ${ct}, expected ${expectedCt}`);
  }

  // Short HTML body that looks like a challenge page
  if (body) {
    const bodyLength = body.length;
    const lower = body.toLowerCase();

    // Challenge page body patterns
    const challengePatterns = [
      { pattern: "just a moment", weight: 3, label: "CF 'Just a moment' challenge" },
      { pattern: "checking your browser", weight: 3, label: "Browser check challenge" },
      { pattern: "enable javascript and cookies", weight: 3, label: "JS/cookie check challenge" },
      { pattern: "attention required", weight: 3, label: "Attention Required block" },
      { pattern: "access denied", weight: 2, label: "Access denied page" },
      { pattern: "you have been blocked", weight: 3, label: "Explicit block message" },
      { pattern: "ray id:", weight: 2, label: "Cloudflare Ray ID in body" },
      { pattern: "ddos protection", weight: 2, label: "DDoS protection page" },
      { pattern: "security check", weight: 1, label: "Security check page" },
      { pattern: "please wait while we verify", weight: 2, label: "Verification wait page" },
      { pattern: "are you a robot", weight: 2, label: "Robot check page" },
      { pattern: "captcha", weight: 2, label: "CAPTCHA challenge" },
    ];

    for (const { pattern, weight, label } of challengePatterns) {
      if (lower.includes(pattern)) {
        score += weight;
        signals.push(label);
      }
    }

    // Short HTML body (< 5kb) when text/html is returned
    if (ct?.includes("html") && bodyLength < 5000 && bodyLength > 100) {
      score += 1;
      signals.push(`Short HTML body (${bodyLength} bytes) — possible challenge page`);
    }
  }

  // WAF/security headers
  const server = getHeader(responseHeaders, "server")?.toLowerCase();
  if (server?.includes("ddos-guard")) {
    score += 3;
    signals.push("DDoS-Guard server header");
  }

  const is_challenged = score >= CHALLENGE_THRESHOLD;
  const is_blocked = !is_challenged && score >= BLOCK_THRESHOLD;
  const confidence = Math.min(score / 10, 1.0);

  let challenge_type: ChallengeType | null = null;
  if (is_challenged) {
    if (
      signals.some((s) =>
        s.toLowerCase().includes("cloudflare") ||
        s.toLowerCase().includes("cf-mitigated") ||
        s.toLowerCase().includes("just a moment")
      )
    ) {
      challenge_type = "bot-challenge";
    } else if (statusCode === 429) {
      challenge_type = "rate-limit";
    } else {
      challenge_type = "waf-block";
    }
  } else if (is_blocked) {
    if (statusCode === 403) {
      challenge_type = "waf-block";
    } else if (statusCode >= 500) {
      challenge_type = "origin-error";
    }
  }

  return {
    is_challenged,
    is_blocked,
    challenge_type,
    confidence,
    signals,
    score,
  };
}
