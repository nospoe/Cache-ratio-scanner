import axios, { AxiosError } from "axios";
import type { ProbeRecord } from "../../types";
import { validateUrl } from "../../utils/ssrfValidator";

const DEFAULT_TIMEOUT = 15000;

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const BROWSER_HEADERS: Record<string, string> = {
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "none",
  "sec-fetch-user": "?1",
  "upgrade-insecure-requests": "1",
};

export interface ProbeOptions {
  timeoutMs?: number;
  maxRedirects?: number;
  userAgent?: string;
  headers?: Record<string, string>;
  validateSsrf?: boolean;
}

export async function runProbe(url: string, options: ProbeOptions = {}): Promise<ProbeRecord> {
  const {
    timeoutMs = DEFAULT_TIMEOUT,
    maxRedirects = 10,
    userAgent = BROWSER_USER_AGENT,
    headers = {},
    validateSsrf = true,
  } = options;

  // SSRF check
  if (validateSsrf) {
    const check = await validateUrl(url, true);
    if (!check.valid) {
      return {
        url,
        final_url: url,
        status_code: 0,
        latency_ms: 0,
        ttfb_ms: 0,
        dns_ms: null,
        connect_ms: null,
        tls_ms: null,
        age_seconds: null,
        content_type: null,
        content_length: null,
        redirect_count: 0,
        redirect_chain: [],
        request_headers: {},
        response_headers: {},
        error: `SSRF protection: ${check.reason}`,
      };
    }
  }

  const startTime = performance.now();
  let ttfbTime: number | null = null;

  try {
    const response = await axios.get(url, {
      timeout: timeoutMs,
      maxRedirects,
      validateStatus: () => true, // accept all status codes
      headers: {
        "User-Agent": userAgent,
        ...BROWSER_HEADERS,
        ...headers,
      },
      transformResponse: (data: unknown) => data, // don't parse
    });

    const endTime = performance.now();
    const totalLatency = Math.round(endTime - startTime);

    // Parse response headers (normalize to lowercase)
    const responseHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(response.headers)) {
      if (typeof v === "string") responseHeaders[k.toLowerCase()] = v;
      else if (Array.isArray(v)) responseHeaders[k.toLowerCase()] = v.join(", ");
    }

    // Extract Age header
    const ageHeader = responseHeaders["age"];
    const age_seconds = ageHeader ? parseInt(ageHeader) : null;

    // Content-type (strip charset)
    const contentTypeRaw = responseHeaders["content-type"];
    const content_type = contentTypeRaw ? contentTypeRaw.split(";")[0].trim() : null;

    const contentLength = responseHeaders["content-length"];
    const content_length = contentLength ? parseInt(contentLength) : null;

    // TTFB approximation (no easy way without TCP hooks in axios, use 30% of total)
    ttfbTime = Math.round(totalLatency * 0.3);

    const finalUrl: string = (response.request as Record<string, unknown>)?.path
      ? url
      : (response.request as Record<string, unknown>)?.res
        ? ((response.request as Record<string, Record<string, string>>).res?.responseUrl ?? url)
        : url;

    return {
      url,
      final_url: finalUrl,
      status_code: response.status,
      latency_ms: totalLatency,
      ttfb_ms: ttfbTime,
      dns_ms: null, // Not available without low-level TCP hooks
      connect_ms: null,
      tls_ms: null,
      age_seconds,
      content_type,
      content_length,
      redirect_count: 0,
      redirect_chain: [],
      request_headers: { "User-Agent": userAgent, ...BROWSER_HEADERS, ...headers },
      response_headers: responseHeaders,
    };
  } catch (err) {
    const endTime = performance.now();
    const latency_ms = Math.round(endTime - startTime);
    const error = err instanceof AxiosError ? err.message : String(err);

    return {
      url,
      final_url: url,
      status_code: 0,
      latency_ms,
      ttfb_ms: 0,
      dns_ms: null,
      connect_ms: null,
      tls_ms: null,
      age_seconds: null,
      content_type: null,
      content_length: null,
      redirect_count: 0,
      redirect_chain: [],
      request_headers: {},
      response_headers: {},
      error,
    };
  }
}
