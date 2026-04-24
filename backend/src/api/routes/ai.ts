import { Router, Request, Response } from "express";
import { childLogger } from "../../utils/logger";

const router = Router();
const log = childLogger("api.ai");

const CUSTOM_AI_BASE_URL = process.env.AI_API_BASE_URL ?? "http://localhost:11434/v1";
const OPENAI_BASE_URL = "https://api.openai.com/v1";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
const ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
const ANTHROPIC_VERSION = "2023-06-01";

// Well-known fallbacks if the /models endpoint is unreachable
const FALLBACK_OPENAI_MODELS = [
  "gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo",
];
const FALLBACK_CUSTOM_MODELS = [
  "gemma3:27b", "gemma4:31b", "gpt-oss:latest",
];
const FALLBACK_ANTHROPIC_MODELS = [
  "claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-4-5-20251001",
  "claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229",
];

async function fetchModels(baseUrl: string, apiKey: string, isAnthropic = false): Promise<string[]> {
  const headers: Record<string, string> = {};
  if (isAnthropic) {
    if (apiKey) headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = ANTHROPIC_VERSION;
  } else {
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const res = await fetch(`${baseUrl}/models`, {
    headers,
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json() as {
    data?: Array<{ id: string; object?: string }>;
    models?: Array<{ name?: string; id?: string }>;
  };

  // OpenAI / Anthropic format: { data: [{ id, object: "model" }] }
  if (Array.isArray(data.data)) {
    return data.data
      .map((m) => m.id)
      .filter((id) =>
        // Keep only chat-capable models — exclude embeddings, tts, whisper, dall-e, etc.
        !id.includes("embedding") &&
        !id.includes("tts") &&
        !id.includes("whisper") &&
        !id.includes("dall-e") &&
        !id.includes("babbage") &&
        !id.includes("davinci") &&
        !id.includes("ada")
      )
      .sort();
  }

  // Ollama format: { models: [{ name }] }
  if (Array.isArray(data.models)) {
    return data.models.map((m) => m.name ?? m.id ?? "").filter(Boolean).sort();
  }

  return [];
}

// GET /api/ai/models?provider=openai|custom|anthropic
router.get("/models", async (req: Request, res: Response) => {
  const rawProvider = req.query.provider;
  const provider = rawProvider === "openai" ? "openai" : rawProvider === "anthropic" ? "anthropic" : "custom";

  let baseUrl: string;
  let apiKey: string;
  let isAnthropic = false;

  if (provider === "openai") {
    baseUrl = OPENAI_BASE_URL;
    apiKey = OPENAI_API_KEY;
  } else if (provider === "anthropic") {
    baseUrl = ANTHROPIC_BASE_URL;
    apiKey = ANTHROPIC_API_KEY;
    isAnthropic = true;
  } else {
    baseUrl = CUSTOM_AI_BASE_URL;
    apiKey = OPENAI_API_KEY;
  }

  try {
    const models = await fetchModels(baseUrl, apiKey, isAnthropic);
    return res.json({ provider, models });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn({ provider, baseUrl, err: msg }, "Failed to fetch AI models — returning fallback list");
    const fallback =
      provider === "openai" ? FALLBACK_OPENAI_MODELS :
      provider === "anthropic" ? FALLBACK_ANTHROPIC_MODELS :
      FALLBACK_CUSTOM_MODELS;
    return res.json({ provider, models: fallback, fallback: true });
  }
});

export default router;
