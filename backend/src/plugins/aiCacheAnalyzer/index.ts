import type { AiCacheAnalysisResult, AiModel, PageWorkingState } from "../../types";
import { childLogger } from "../../utils/logger";

const log = childLogger("aiCacheAnalyzer");

const CUSTOM_AI_BASE_URL = process.env.AI_API_BASE_URL ?? "https://chat.netcentric.biz/api";
const OPENAI_BASE_URL = "https://api.openai.com/v1";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";

function getBaseUrl(provider?: string): string {
  return provider === "openai" ? OPENAI_BASE_URL : CUSTOM_AI_BASE_URL;
}

const SYSTEM_PROMPT = `You are an expert HTTP caching analyst. Your job is to examine HTTP response headers and timing data to determine whether a response was served from a CDN cache.

Analyze the provided headers and timing, reasoning step-by-step about the cache state. Consider:

Headers:
- Cache-Control (max-age, no-cache, no-store, s-maxage, public, private)
- X-Cache, X-Cache-Status, CF-Cache-Status (CDN-specific cache indicators)
- Age (seconds the object has been in cache; >0 strongly indicates a cache hit)
- ETag, Last-Modified (validators that suggest cacheability)
- Pragma, Expires (legacy cache control)
- Vary (affects cache key)
- Via, X-Served-By (proxy/CDN routing signals)
- Set-Cookie (often prevents caching)
- Surrogate-Control, Surrogate-Key (CDN override headers)
- Akamai-specific: x-akamai-request-id, x-akamai-edgescape, x-check-cacheable, x-cache-key, x-cache (TCP_HIT/TCP_MISS/TCP_EXPIRED_HIT), server: AkamaiGHost or "Akamai Image Manager"

Timing signals (use these alongside headers — do NOT ignore them):
- A dramatic latency drop from cold to warmed probe (e.g. >50% reduction) is a strong signal that the CDN is serving from an edge cache on subsequent requests, even if no explicit X-Cache header is present.
- CDN cache HITs typically have TTFB < 20ms and latency < 50ms. Higher values suggest origin fetches.
- If warm latency stays close to cold latency despite multiple warming attempts, the CDN is likely not caching the resource.
- Age header absent on warm probes despite low latency may indicate a CDN edge with no Age header emission (some Akamai configs omit Age).

After reasoning, output ONLY a valid JSON object (no markdown, no extra text) with this exact structure:
{
  "cached": <boolean — true if the response was likely served from a CDN cache on warm requests>,
  "reasoning": "<concise explanation referencing both headers and timing that led to this conclusion>",
  "cache_hit_ratio": <float 0.0–1.0 — estimated proportion of requests that would be cache hits>,
  "confidence": <float 0.0–1.0 — how confident you are in this assessment>,
  "inferred_cdn": "<name of the CDN provider you identify from the headers, e.g. 'Akamai', 'Cloudflare', 'CloudFront', 'Fastly', or null if none detected>"
}`;

function buildUserMessage(state: PageWorkingState): string {
  const lines: string[] = [`URL: ${state.url}`, ""];

  const cold = state.coldProbe;
  if (cold) {
    lines.push(
      `Cold probe — HTTP ${cold.status_code} | latency=${cold.latency_ms}ms | ttfb=${cold.ttfb_ms != null ? Math.round(cold.ttfb_ms) + "ms" : "n/a"}:`
    );
    for (const [k, v] of Object.entries(cold.response_headers)) {
      lines.push(`  ${k}: ${v}`);
    }
    lines.push("");
  }

  const warmed = state.warmedProbe;
  if (warmed) {
    lines.push(
      `Warmed probe — HTTP ${warmed.status_code} | latency=${warmed.latency_ms}ms | ttfb=${warmed.ttfb_ms != null ? Math.round(warmed.ttfb_ms) + "ms" : "n/a"}:`
    );
    for (const [k, v] of Object.entries(warmed.response_headers)) {
      lines.push(`  ${k}: ${v}`);
    }
    lines.push("");
  }

  if (state.warmEvents.length > 0) {
    lines.push("Cache warming events:");
    for (const ev of state.warmEvents) {
      lines.push(
        `  Request #${ev.request_num} (${ev.phase}): HTTP ${ev.http_status} — state=${ev.cache_state} latency=${ev.latency_ms}ms`
      );
    }
    lines.push("");
  }

  lines.push(
    "Based on the headers above, determine whether this response was served from cache and estimate the cache hit ratio."
  );

  return lines.join("\n");
}

function parseAiResponse(text: string): Omit<AiCacheAnalysisResult, "model"> {
  // Strip markdown code fences if present
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

  // Find the first JSON object in the response
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error(`No JSON object found in AI response: ${text.slice(0, 200)}`);
  }

  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;

  const cached = typeof parsed.cached === "boolean" ? parsed.cached : Boolean(parsed.cached);
  const reasoning = typeof parsed.reasoning === "string" ? parsed.reasoning : String(parsed.reasoning ?? "");
  const cache_hit_ratio = Math.min(1, Math.max(0, Number(parsed.cache_hit_ratio ?? 0)));
  const confidence = Math.min(1, Math.max(0, Number(parsed.confidence ?? 0)));
  const inferred_cdn = parsed.inferred_cdn != null && parsed.inferred_cdn !== "null"
    ? String(parsed.inferred_cdn)
    : null;

  return { cached, reasoning, cache_hit_ratio, confidence, inferred_cdn };
}

export async function runAiCacheAnalysis(state: PageWorkingState): Promise<PageWorkingState> {
  const model = state.settings.aiModel ?? "gpt-4o-mini";
  const endpoint = `${getBaseUrl(state.settings.aiProvider)}/chat/completions`;

  log.info({ pageId: state.pageId, url: state.url, model, endpoint }, "Starting AI cache analysis");

  const userMessage = buildUserMessage(state);

  const requestBody: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
  };
  // Reasoning models (o1, o3, gpt-5, …) only accept the default temperature.
  // For non-OpenAI (Ollama-compatible), cap tokens and set low temperature.
  if (state.settings.aiProvider !== "openai") {
    requestBody.temperature = 0.1;
    requestBody.max_tokens = 1024;
  }

  log.debug(
    {
      pageId: state.pageId,
      endpoint,
      model,
      system_prompt_chars: SYSTEM_PROMPT.length,
      user_message_chars: userMessage.length,
      user_message: userMessage,
    },
    "AI request payload"
  );

  let result: AiCacheAnalysisResult;

  const t0 = Date.now();

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(OPENAI_API_KEY ? { Authorization: `Bearer ${OPENAI_API_KEY}` } : {}),
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(60_000),
    });

    const latencyMs = Date.now() - t0;

    if (!response.ok) {
      const rawBody = await response.text().catch(() => "");
      // Scrub any bearer token pattern before logging — defensive measure in case
      // the upstream server echoes back request metadata in its error payload.
      const safeBody = rawBody.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, "Bearer [Redacted]").slice(0, 500);
      log.error(
        { pageId: state.pageId, url: state.url, httpStatus: response.status, latencyMs, body: safeBody },
        "AI API returned non-2xx response"
      );
      throw new Error(`AI API returned ${response.status}: ${safeBody.slice(0, 200)}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      model?: string;
    };

    log.debug(
      {
        pageId: state.pageId,
        latencyMs,
        httpStatus: response.status,
        reportedModel: data.model,
        usage: data.usage ?? null,
        rawContent: data.choices?.[0]?.message?.content,
      },
      "AI raw response"
    );

    log.info(
      {
        pageId: state.pageId,
        url: state.url,
        model,
        latencyMs,
        promptTokens: data.usage?.prompt_tokens ?? null,
        completionTokens: data.usage?.completion_tokens ?? null,
        totalTokens: data.usage?.total_tokens ?? null,
      },
      "AI API response received"
    );

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("AI API returned empty content");
    }

    const parsed = parseAiResponse(content);
    result = { ...parsed, model };

    log.info(
      {
        pageId: state.pageId,
        url: state.url,
        model,
        latencyMs,
        cached: result.cached,
        cache_hit_ratio: result.cache_hit_ratio,
        confidence: result.confidence,
        reasoning: result.reasoning,
      },
      "AI cache analysis complete"
    );
  } catch (err) {
    const latencyMs = Date.now() - t0;
    const msg = err instanceof Error ? err.message : String(err);
    log.warn(
      { pageId: state.pageId, url: state.url, model, endpoint, latencyMs, err: msg },
      "AI cache analysis failed — skipping"
    );
    return state;
  }

  return { ...state, aiCacheAnalysis: result };
}
