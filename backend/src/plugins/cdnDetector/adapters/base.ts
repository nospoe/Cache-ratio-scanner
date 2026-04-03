import type { CdnAdapter } from "../../types";

export { CdnAdapter };

// Utility: get header value case-insensitively
export function getHeader(headers: Record<string, string>, name: string): string | undefined {
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower) return v;
  }
  return undefined;
}

export function hasHeader(headers: Record<string, string>, name: string): boolean {
  return getHeader(headers, name) !== undefined;
}

// Parse `server-timing` for a `cdn-cache; desc=HIT|MISS|PASS|BYPASS` entry.
// Returns null if the header is absent or the entry isn't recognised.
export function parseCdnCacheServerTiming(
  serverTiming: string
): "HIT" | "MISS" | "BYPASS" | null {
  // Each entry is separated by commas; entries look like: name; dur=N; desc="VALUE"
  for (const entry of serverTiming.split(",")) {
    const namePart = entry.split(";")[0].trim().toLowerCase();
    if (namePart !== "cdn-cache") continue;
    // Extract desc value
    const descMatch = entry.match(/desc=["']?([^"',;]+)["']?/i);
    if (!descMatch) continue;
    const desc = descMatch[1].trim().toUpperCase();
    if (desc === "HIT") return "HIT";
    if (desc === "MISS") return "MISS";
    if (desc === "PASS" || desc === "BYPASS") return "BYPASS";
  }
  return null;
}
