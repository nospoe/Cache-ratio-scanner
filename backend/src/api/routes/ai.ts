import { Router, Request, Response } from "express";
import { childLogger } from "../../utils/logger";

const router = Router();
const log = childLogger("api.ai");

const CUSTOM_AI_BASE_URL = process.env.AI_API_BASE_URL ?? "https://chat.netcentric.biz/api";
const OPENAI_BASE_URL = "https://api.openai.com/v1";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";

// Well-known fallbacks if the /models endpoint is unreachable
const FALLBACK_OPENAI_MODELS = [
  "gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo",
];
const FALLBACK_CUSTOM_MODELS = [
  "gemma3:27b", "gemma4:31b", "gpt-oss:latest",
];

async function fetchModels(baseUrl: string, apiKey: string): Promise<string[]> {
  const res = await fetch(`${baseUrl}/models`, {
    headers: {
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json() as {
    data?: Array<{ id: string; object?: string }>;
    models?: Array<{ name?: string; id?: string }>;
  };

  // OpenAI format: { data: [{ id, object: "model" }] }
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

// GET /api/ai/models?provider=openai|custom
router.get("/models", async (req: Request, res: Response) => {
  const provider = req.query.provider === "openai" ? "openai" : "custom";
  const baseUrl = provider === "openai" ? OPENAI_BASE_URL : CUSTOM_AI_BASE_URL;
  const apiKey = OPENAI_API_KEY;

  try {
    const models = await fetchModels(baseUrl, apiKey);
    return res.json({ provider, models });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn({ provider, baseUrl, err: msg }, "Failed to fetch AI models — returning fallback list");
    const fallback = provider === "openai" ? FALLBACK_OPENAI_MODELS : FALLBACK_CUSTOM_MODELS;
    return res.json({ provider, models: fallback, fallback: true });
  }
});

export default router;
