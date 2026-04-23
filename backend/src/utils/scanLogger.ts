import { getRedisConnection } from "../queue/scanQueue";
import { childLogger } from "./logger";

const log = childLogger("scanLogger");

const LOG_LIST_KEY = (scanId: string) => `scan:logs:${scanId}`;
const LOG_CHANNEL   = (scanId: string) => `scan:logs:channel:${scanId}`;
const MAX_LOG_LINES = 2000;
const LOG_TTL       = 86400; // 24 h

export interface ScanLogLine {
  ts: number;
  level: "info" | "warn" | "error" | "debug";
  msg: string;
  component?: string;
}

export async function publishScanLog(
  scanId: string,
  level: ScanLogLine["level"],
  msg: string,
  component = "worker",
): Promise<void> {
  const line: ScanLogLine = { ts: Date.now(), level, msg, component };
  const serialized = JSON.stringify(line);
  const redis = getRedisConnection();

  try {
    const listKey = LOG_LIST_KEY(scanId);
    const channel  = LOG_CHANNEL(scanId);

    await redis.rpush(listKey, serialized);
    await redis.ltrim(listKey, -MAX_LOG_LINES, -1);
    await redis.expire(listKey, LOG_TTL);
    await redis.publish(channel, serialized);
  } catch (err) {
    log.warn({ scanId, err }, "Failed to publish scan log");
  }
}

export async function getScanLogs(scanId: string): Promise<ScanLogLine[]> {
  const redis = getRedisConnection();
  try {
    const lines = await redis.lrange(LOG_LIST_KEY(scanId), 0, -1);
    return lines.map((l) => JSON.parse(l) as ScanLogLine);
  } catch {
    return [];
  }
}

export function getScanLogChannel(scanId: string): string {
  return LOG_CHANNEL(scanId);
}
