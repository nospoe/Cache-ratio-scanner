import { Queue, QueueEvents } from "bullmq";
import IORedis from "ioredis";
import type { ScanJobPayload } from "../types";

let redisConnection: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!redisConnection) {
    const url = process.env.REDIS_URL || "redis://localhost:6379";
    redisConnection = new IORedis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return redisConnection;
}

/** Creates a fresh, independent Redis connection (needed for subscribe). */
export function createRedisConnection(): IORedis {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  return new IORedis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

export const SCAN_QUEUE_NAME = "scan-jobs";

let scanQueue: Queue<ScanJobPayload> | null = null;

export function getScanQueue(): Queue<ScanJobPayload> {
  if (!scanQueue) {
    scanQueue = new Queue<ScanJobPayload>(SCAN_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { count: 100, age: 3600 },
        removeOnFail: { count: 50, age: 86400 },
      },
    });
  }
  return scanQueue;
}

let queueEvents: QueueEvents | null = null;

export function getScanQueueEvents(): QueueEvents {
  if (!queueEvents) {
    queueEvents = new QueueEvents(SCAN_QUEUE_NAME, {
      connection: getRedisConnection(),
    });
  }
  return queueEvents;
}

export async function enqueueScan(payload: ScanJobPayload): Promise<string> {
  const queue = getScanQueue();
  const job = await queue.add("scan", payload, {
    jobId: `scan-${payload.scanId}`,
  });
  return job.id ?? payload.scanId;
}

export async function getScanJob(scanId: string) {
  const queue = getScanQueue();
  return queue.getJob(`scan-${scanId}`);
}

export async function cancelScanJob(scanId: string): Promise<boolean> {
  const job = await getScanJob(scanId);
  if (!job) return false;
  const state = await job.getState();
  if (state === "waiting" || state === "delayed") {
    await job.remove();
    return true;
  }
  if (state === "active") {
    // Signal the worker to stop via a Redis key
    const redis = getRedisConnection();
    await redis.set(`cancel:${scanId}`, "1", "EX", 3600);
    return true;
  }
  return false;
}

export async function isCancelled(scanId: string): Promise<boolean> {
  const redis = getRedisConnection();
  const val = await redis.get(`cancel:${scanId}`);
  return val === "1";
}
