import type { ScanSettings } from "../types";
import { orchestratePage } from "./scanOrchestrator";
import type { CrawledUrl } from "../plugins/crawler";
import { isCancelled } from "../queue/scanQueue";
import { childLogger } from "../utils/logger";
import { sleep } from "../utils/retry";

const log = childLogger("batchRunner");

// Simple semaphore for concurrency control
class Semaphore {
  private queue: (() => void)[] = [];
  private running = 0;

  constructor(private max: number) {}

  async acquire(): Promise<void> {
    if (this.running < this.max) {
      this.running++;
      return;
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.running++;
  }

  release(): void {
    this.running--;
    const next = this.queue.shift();
    if (next) next();
  }
}

export interface BatchProgress {
  total: number;
  completed: number;
  failed: number;
  currentUrl?: string;
}

export async function runBatch(
  urls: CrawledUrl[],
  scanId: string,
  settings: ScanSettings,
  onProgress?: (progress: BatchProgress) => void
): Promise<void> {
  const globalSem = new Semaphore(settings.concurrency);
  const hostSemaphores = new Map<string, Semaphore>();

  let completed = 0;
  let failed = 0;

  function getHostSem(url: string): Semaphore {
    const host = new URL(url).hostname;
    if (!hostSemaphores.has(host)) {
      hostSemaphores.set(host, new Semaphore(settings.perHostConcurrency));
    }
    return hostSemaphores.get(host)!;
  }

  const tasks = urls.map(({ url, depth }) => async () => {
    // Check cancellation
    if (await isCancelled(scanId)) {
      log.info({ scanId }, "Scan cancelled, stopping batch");
      return;
    }

    await globalSem.acquire();
    const hostSem = getHostSem(url);
    await hostSem.acquire();

    onProgress?.({ total: urls.length, completed, failed, currentUrl: url });

    try {
      if (settings.crawlDelay > 0) {
        await sleep(settings.crawlDelay);
      }
      await orchestratePage(url, depth, scanId, settings);
      completed++;
    } catch (err) {
      failed++;
      log.error({ url, scanId, err }, "Page orchestration failed in batch");
    } finally {
      globalSem.release();
      hostSem.release();
      onProgress?.({ total: urls.length, completed, failed });
    }
  });

  // Run all tasks concurrently (semaphores handle limits)
  await Promise.all(tasks.map((t) => t()));
}
