import type { AiCacheAnalysisResult, AiModel, PageWorkingState } from "../../types";
import { childLogger } from "../../utils/logger";

const log = childLogger("aiCacheAnalyzer");

const AI_API_BASE_URL = process.env.AI_API_BASE_URL ?? "https://chat.netcentric.biz/api";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";

const SYSTEM_PROMPT = `You are an expert HTTP caching analyst. Your job is to examine HTTP response headers and determine whether a response was served from cache.

Analyze the provided headers and reason step-by-step about the cache state. Consider headers such as:
- Cache-Control (max-age, no-cache, no-store, s-maxage, public, private)
- X-Cache, X-Cache-Status, CF-Cache-Status (CDN-specific cache indicators)
- Age (seconds the object has been in cache; >0 strongly indicates a cache hit)
- ETag, Last-Modified (validators that suggest cacheability)
- Pragma, Expires (legacy cache control)
- Vary (affects cache key)
- Via, X-Served-By (proxy/CDN routing signals)
- Set-Cookie (often prevents caching)
- Surrogate-Control, Surrogate-Key (CDN override headers)
- Akamai-specific: x-akamai-request-id, x-check-cacheable, x-cache-key, x-cache (TCP_HIT/TCP_MISS/TCP_EXPIRED_HIT), server: AkamaiGHost or "Akamai Image Manager"

After reasoning, output ONLY a valid JSON object (no markdown, no extra text) with this exact structure:
{
  "cached": <boolean — true if the response was served from cache>,
  "reasoning": "<concise explanation of what headers led to this conclusion>",
  "cache_hit_ratio": <float 0.0–1.0 — estimated proportion of requests that would be cache hits based on these headers>,
  "confidence": <float 0.0–1.0 — how confident you are in this assessment>
}`;

function buildUserMessage(state: PageWorkingState): string {
  const lines: string[] = [`URL: ${state.url}`, ""];

  const cold = state.coldProbe;
  if (cold) {
    lines.push(`Cold probe — HTTP ${cold.status_code}:`);
    for (const [k, v] of Object.entries(cold.response_headers)) {
      lines.push(`  ${k}: ${v}`);
    }
    lines.push("");
  }

  const warmed = state.warmedProbe;
  if (warmed) {
    lines.push(`Warmed probe — HTTP ${warmed.status_code}:`);
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

  return { cached, reasoning, cache_hit_ratio, confidence };
}

export async function runAiCacheAnalysis(state: PageWorkingState): Promise<PageWorkingState> {
  const model = state.settings.aiModel ?? "gemma3:27b";
  const endpoint = `${AI_API_BASE_URL}/chat/completions`;

  log.info({ pageId: state.pageId, url: state.url, model, endpoint }, "Starting AI cache analysis");

  const userMessage = buildUserMessage(state);

  const requestBody = {
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    temperature: 0.1,
    max_tokens: 512,
  };

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
