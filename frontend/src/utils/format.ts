export function formatDistanceToNow(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);

  if (diffSecs < 60) return `${diffSecs}s`;
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export function formatMs(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function formatRatio(ratio: number | null | undefined): string {
  if (ratio == null) return "—";
  return `${Math.round(ratio * 100)}%`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

export function lcpTrend(ms: number | null): "good" | "warn" | "bad" | "neutral" {
  if (ms == null) return "neutral";
  if (ms <= 2500) return "good";
  if (ms <= 4000) return "warn";
  return "bad";
}

export function ttfbTrend(ms: number | null): "good" | "warn" | "bad" | "neutral" {
  if (ms == null) return "neutral";
  if (ms <= 600) return "good";
  if (ms <= 1500) return "warn";
  return "bad";
}

export function clsTrend(cls: number | null): "good" | "warn" | "bad" | "neutral" {
  if (cls == null) return "neutral";
  if (cls <= 0.1) return "good";
  if (cls <= 0.25) return "warn";
  return "bad";
}

export function tbtTrend(ms: number | null): "good" | "warn" | "bad" | "neutral" {
  if (ms == null) return "neutral";
  if (ms <= 200) return "good";
  if (ms <= 600) return "warn";
  return "bad";
}
