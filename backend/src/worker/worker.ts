import { Worker, Job } from "bullmq";
import { getRedisConnection, SCAN_QUEUE_NAME } from "../queue/scanQueue";
import type { ScanJobPayload, ScanSettings } from "../types";
import { resolveUrls } from "../plugins/crawler";
import { runBatch } from "../scan/batchRunner";
import { buildAggregate } from "../scan/aggregateBuilder";
import { updateScanStatus, updateScanAggregate } from "../db/repositories/scanRepo";
import { auditLog } from "../db/repositories/auditRepo";
import { runMigrations } from "../db/migrate";
import { childLogger } from "../utils/logger";

const log = childLogger("worker");

const DEFAULT_SETTINGS: ScanSettings = {
  mode: "single",
  deviceProfile: "desktop",
  concurrency: 3,
  perHostConcurrency: 2,
  maxPages: 100,
  maxCrawlDepth: 3,
  maxWarmAttempts: parseInt(process.env.MAX_WARM_ATTEMPTS || "5"),
  warmDelayMs: parseInt(process.env.WARM_DELAY_MS || "500"),
  requestTimeoutMs: parseInt(process.env.PROBE_TIMEOUT_MS || "15000"),
  browserTimeoutMs: parseInt(process.env.BROWSER_TIMEOUT_MS || "30000"),
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

async function processScan(job: Job<ScanJobPayload>): Promise<void> {
  const { scanId, rootInput, mode, settings: jobSettings, urlList } = job.data;
  const settings: ScanSettings = { ...DEFAULT_SETTINGS, ...jobSettings };

  log.info({ scanId, mode }, "Processing scan job");

  await updateScanStatus(scanId, "running");
  await auditLog({ event: "scan.started", scanId, actor: "worker", details: { mode } });

  const startTime = Date.now();

  try {
    // Resolve URLs
    await job.updateProgress({ status: "resolving", message: "Resolving URLs..." });
    const crawledUrls = await resolveUrls(mode, rootInput, settings, urlList);

    if (crawledUrls.length === 0) {
      throw new Error("No URLs resolved from input");
    }

    log.info({ scanId, count: crawledUrls.length }, "URLs resolved, starting batch");

    // Run batch
    await runBatch(crawledUrls, scanId, settings, async (progress) => {
      await job.updateProgress({
        status: "scanning",
        total: progress.total,
        completed: progress.completed,
        failed: progress.failed,
        currentUrl: progress.currentUrl,
        message: `Scanning ${progress.completed}/${progress.total} pages`,
      });
    });

    // Build aggregate
    await job.updateProgress({ status: "aggregating", message: "Building summary..." });
    const scanDurationMs = Date.now() - startTime;
    const aggregate = await buildAggregate(scanId, scanDurationMs);
    await updateScanAggregate(scanId, aggregate);

    await auditLog({
      event: "scan.completed",
      scanId,
      actor: "worker",
      details: {
        total: aggregate.total_pages,
        completed: aggregate.completed_pages,
        duration_ms: scanDurationMs,
      },
    });

    log.info({ scanId, duration: scanDurationMs }, "Scan completed successfully");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ scanId, err: msg }, "Scan failed");
    await updateScanStatus(scanId, "failed", msg);
    await auditLog({ event: "scan.failed", scanId, actor: "worker", details: { error: msg } });
    throw err;
  }
}

async function main() {
  log.info("Running DB migrations...");
  await runMigrations();

  const concurrency = parseInt(process.env.WORKER_CONCURRENCY || "3");

  log.info({ concurrency }, "Starting BullMQ worker");

  const worker = new Worker<ScanJobPayload>(
    SCAN_QUEUE_NAME,
    processScan,
    {
      connection: getRedisConnection(),
      concurrency,
    }
  );

  worker.on("completed", (job) => {
    log.info({ jobId: job.id }, "Job completed");
  });

  worker.on("failed", (job, err) => {
    log.error({ jobId: job?.id, err: err.message }, "Job failed");
  });

  worker.on("error", (err) => {
    log.error({ err }, "Worker error");
  });

  process.on("SIGTERM", async () => {
    log.info("SIGTERM received, shutting down worker");
    await worker.close();
    process.exit(0);
  });

  log.info("Worker ready");
}

main().catch((err) => {
  log.error({ err }, "Worker startup failed");
  process.exit(1);
});
