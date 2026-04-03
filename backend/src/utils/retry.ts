export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const { maxAttempts, baseDelayMs, maxDelayMs = 10000, onRetry } = options;

  let lastError: Error = new Error("Unknown error");
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === maxAttempts) break;
      const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
      onRetry?.(attempt, lastError);
      await sleep(delay);
    }
  }
  throw lastError;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
