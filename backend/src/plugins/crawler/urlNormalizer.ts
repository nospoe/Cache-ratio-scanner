import { URL } from "url";

export interface NormalizeOptions {
  normalizeQuerystrings: boolean;
  removeHash: boolean;
}

export function normalizeUrl(rawUrl: string, options: NormalizeOptions = { normalizeQuerystrings: false, removeHash: true }): string | null {
  try {
    const u = new URL(rawUrl);

    // Normalize scheme and host to lowercase
    u.protocol = u.protocol.toLowerCase();
    u.hostname = u.hostname.toLowerCase();

    // Remove default ports
    if ((u.protocol === "http:" && u.port === "80") ||
        (u.protocol === "https:" && u.port === "443")) {
      u.port = "";
    }

    // Remove hash
    if (options.removeHash) {
      u.hash = "";
    }

    // Sort query params for canonical representation
    if (options.normalizeQuerystrings && u.search) {
      const params = new URLSearchParams(u.searchParams);
      const sorted = new URLSearchParams([...params.entries()].sort(([a], [b]) => a.localeCompare(b)));
      u.search = sorted.toString() ? "?" + sorted.toString() : "";
    }

    // Remove trailing slash from path (except root)
    if (u.pathname !== "/" && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.slice(0, -1);
    }

    return u.toString();
  } catch {
    return null;
  }
}

export function isSameOrigin(url: string, baseUrl: string): boolean {
  try {
    return new URL(url).origin === new URL(baseUrl).origin;
  } catch {
    return false;
  }
}

export function resolveUrl(href: string, baseUrl: string): string | null {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}
