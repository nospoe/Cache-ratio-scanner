import { Router, Request, Response } from "express";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { createScan, getScan, listScans, cancelScan } from "../../db/repositories/scanRepo";
import { enqueueScan, cancelScanJob, getScanJob, createRedisConnection } from "../../queue/scanQueue";
import { getScanLogs, getScanLogChannel } from "../../utils/scanLogger";
import { auditLog } from "../../db/repositories/auditRepo";
import { validateUrlSync } from "../../utils/ssrfValidator";
import type { ScanSettings } from "../../types";
import { childLogger } from "../../utils/logger";

const router = Router();
const log = childLogger("api.scans");

const settingsSchema = z.object({
  deviceProfile: z.enum(["desktop", "mobile", "custom"]).optional(),
  concurrency: z.number().int().min(1).max(10).optional(),
  perHostConcurrency: z.number().int().min(1).max(5).optional(),
  maxPages: z.number().int().min(1).max(500).optional(),
  maxCrawlDepth: z.number().int().min(0).max(10).optional(),
  maxWarmAttempts: z.number().int().min(1).max(10).optional(),
  warmDelayMs: z.number().int().min(100).max(5000).optional(),
  requestTimeoutMs: z.number().int().min(1000).max(60000).optional(),
  browserTimeoutMs: z.number().int().min(5000).max(120000).optional(),
  maxRedirects: z.number().int().min(0).max(20).optional(),
  crawlDelay: z.number().int().min(0).max(5000).optional(),
  sameOriginOnly: z.boolean().optional(),
  respectRobotsTxt: z.boolean().optional(),
  normalizeQuerystrings: z.boolean().optional(),
  includePattern: z.string().max(200).optional(),
  excludePattern: z.string().max(200).optional(),
  headers: z.record(z.string()).optional(),
  scanPerformance: z.boolean().optional(),
  scanCache: z.boolean().optional(),
  aiCacheAnalysis: z.boolean().optional(),
  aiProvider: z.enum(["openai", "custom", "anthropic"]).optional(),
  aiModel: z.string().max(100).optional(),
  aiExtraPrompt: z.string().max(2000).optional(),
  scanResources: z.boolean().optional(),
  debugHeaders: z.record(z.string().max(1000)).optional(),
});

const createScanSchema = z.object({
  mode: z.enum(["single", "list", "sitemap", "crawl"]),
  rootInput: z.string().min(1).max(2000),
  urls: z.array(z.string().url()).max(500).optional(),
  settings: settingsSchema.optional(),
});

const DEFAULT_SETTINGS: ScanSettings = {
  mode: "single",
  deviceProfile: "desktop",
  concurrency: 3,
  perHostConcurrency: 2,
  maxPages: 100,
  maxCrawlDepth: 3,
  maxWarmAttempts: 5,
  warmDelayMs: 500,
  requestTimeoutMs: 15000,
  browserTimeoutMs: 30000,
  maxRedirects: 10,
  crawlDelay: 0,
  sameOriginOnly: true,
  respectRobotsTxt: true,
  normalizeQuerystrings: false,
  scanPerformance: true,
  scanCache: true,
  aiCacheAnalysis: false,
  scanResources: false,
};

// POST /scans
router.post("/", async (req: Request, res: Response) => {
  const parseResult = createScanSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Invalid request", details: parseResult.error.errors });
  }

  const { mode, rootInput, urls, settings: userSettings } = parseResult.data;

  // SSRF validation on rootInput
  const ssrfEnabled = process.env.SSRF_PROTECTION !== "false";
  const urlToCheck = mode === "single" ? rootInput : null;
  if (urlToCheck && ssrfEnabled) {
    const check = validateUrlSync(urlToCheck);
    if (!check.valid) {
      return res.status(400).json({ error: `URL validation failed: ${check.reason}` });
    }
  }

  // Validate supplied URLs
  if (urls) {
    for (const u of urls) {
      const check = validateUrlSync(u);
      if (!check.valid) {
        return res.status(400).json({ error: `Invalid URL in list: ${u} — ${check.reason}` });
      }
    }
  }

  const scanId = uuidv4();
  const settings: ScanSettings = {
    ...DEFAULT_SETTINGS,
    ...userSettings,
    mode,
  };

  try {
    const scan = await createScan({ id: scanId, mode, root_input: rootInput, settings });
    const jobId = await enqueueScan({ scanId, rootInput, mode, settings, urlList: urls });
    await auditLog({ event: "scan.created", scanId, actor: "api", details: { mode, rootInput } });

    log.info({ scanId, mode }, "Scan created and queued");

    return res.status(201).json({
      id: scan.id,
      status: "queued",
      mode,
      createdAt: scan.created_at,
      jobId,
    });
  } catch (err) {
    log.error({ err }, "Failed to create scan");
    return res.status(500).json({ error: "Failed to create scan" });
  }
});

// GET /scans
router.get("/", async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page ?? "1"));
  const pageSize = Math.min(parseInt(String(req.query.pageSize ?? "20")), 100);

  try {
    const { scans, total } = await listScans(page, pageSize);
    return res.json({
      items: scans,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (err) {
    log.error({ err }, "Failed to list scans");
    return res.status(500).json({ error: "Failed to list scans" });
  }
});

// GET /scans/:id
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const scan = await getScan(req.params.id);
    if (!scan) return res.status(404).json({ error: "Scan not found" });

    // Get live job progress if scan is running
    let progress = null;
    if (scan.status === "running" || scan.status === "queued") {
      const job = await getScanJob(req.params.id);
      if (job) {
        progress = job.progress;
      }
    }

    return res.json({ ...scan, progress });
  } catch (err) {
    log.error({ err }, "Failed to get scan");
    return res.status(500).json({ error: "Failed to get scan" });
  }
});

// DELETE /scans/:id (cancel)
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const [dbCancelled, queueCancelled] = await Promise.all([
      cancelScan(req.params.id),
      cancelScanJob(req.params.id),
    ]);

    if (!dbCancelled) {
      return res.status(404).json({ error: "Scan not found or already completed" });
    }

    await auditLog({ event: "scan.cancelled", scanId: req.params.id, actor: "api" });
    return res.json({ success: true });
  } catch (err) {
    log.error({ err }, "Failed to cancel scan");
    return res.status(500).json({ error: "Failed to cancel scan" });
  }
});

// GET /scans/:id/progress (SSE)
router.get("/:id/progress", async (req: Request, res: Response) => {
  const scanId = req.params.id;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sendEvent = (data: unknown) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Poll scan status every 2 seconds
  let closed = false;
  req.on("close", () => { closed = true; });

  const poll = async () => {
    while (!closed) {
      try {
        const scan = await getScan(scanId);
        if (!scan) {
          sendEvent({ error: "Scan not found" });
          break;
        }

        let progress = null;
        if (scan.status === "running" || scan.status === "queued") {
          const job = await getScanJob(scanId);
          progress = job ? job.progress : null;
        }

        sendEvent({ scan: { id: scan.id, status: scan.status }, progress });

        if (scan.status === "completed" || scan.status === "failed" || scan.status === "cancelled") {
          break;
        }

        await new Promise((r) => setTimeout(r, 2000));
      } catch {
        break;
      }
    }
    res.end();
  };

  poll().catch(() => res.end());
});

// GET /scans/:id/logs (SSE — historical + live log stream)
router.get("/:id/logs", async (req: Request, res: Response) => {
  const scanId = req.params.id;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sendLine = (data: unknown) => {
    try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch { /* client gone */ }
  };

  // Flush historical log lines first
  try {
    const history = await getScanLogs(scanId);
    history.forEach(sendLine);
  } catch { /* ignore */ }

  // If scan is already terminal, just close
  const scan = await getScan(scanId).catch(() => null);
  const TERMINAL = ["completed", "failed", "cancelled"];
  if (!scan || TERMINAL.includes(scan.status)) {
    sendLine({ type: "end" });
    return res.end();
  }

  // Subscribe to live log events via Redis pub/sub
  const subscriber = createRedisConnection();
  const channel = getScanLogChannel(scanId);
  let closed = false;

  req.on("close", async () => {
    closed = true;
    try { await subscriber.unsubscribe(channel); } catch { /* ignore */ }
    subscriber.disconnect();
  });

  subscriber.on("message", (_chan: string, message: string) => {
    if (closed) return;
    try { sendLine(JSON.parse(message)); } catch { /* ignore */ }
  });

  await subscriber.subscribe(channel).catch(() => { /* ignore */ });

  // Poll for terminal state so we can close the stream cleanly
  (async () => {
    while (!closed) {
      await new Promise((r) => setTimeout(r, 3000));
      if (closed) break;
      try {
        const s = await getScan(scanId);
        if (!s || TERMINAL.includes(s.status)) {
          sendLine({ type: "end" });
          res.end();
          await subscriber.unsubscribe(channel).catch(() => {});
          subscriber.disconnect();
          closed = true;
        }
      } catch { break; }
    }
  })().catch(() => { res.end(); });
});

export default router;
