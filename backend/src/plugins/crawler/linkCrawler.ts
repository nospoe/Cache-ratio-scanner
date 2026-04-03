import axios from "axios";
import * as cheerio from "cheerio";
import robotsParser from "robots-parser";
import { normalizeUrl, isSameOrigin, resolveUrl } from "./urlNormalizer";
import type { ScanSettings } from "../../types";

export interface CrawlResult {
  url: string;
  depth: number;
}

export async function crawlDomain(
  rootUrl: string,
  settings: ScanSettings
): Promise<CrawlResult[]> {
  const {
    maxPages,
    maxCrawlDepth,
    sameOriginOnly,
    respectRobotsTxt,
    normalizeQuerystrings,
    includePattern,
    excludePattern,
  } = settings;

  const includeRe = includePattern ? new RegExp(includePattern) : null;
  const excludeRe = excludePattern ? new RegExp(excludePattern) : null;

  // Fetch robots.txt
  let robots: ReturnType<typeof robotsParser> | null = null;
  if (respectRobotsTxt) {
    try {
      const robotsUrl = new URL("/robots.txt", rootUrl).toString();
      const resp = await axios.get<string>(robotsUrl, {
        timeout: 5000,
        responseType: "text",
        headers: { "User-Agent": "SiteScanner/1.0" },
      });
      robots = robotsParser(robotsUrl, resp.data);
    } catch {
      // no robots.txt — proceed
    }
  }

  const visited = new Set<string>();
  const results: CrawlResult[] = [];

  // BFS queue
  const queue: { url: string; depth: number }[] = [{ url: rootUrl, depth: 0 }];

  while (queue.length > 0 && results.length < maxPages) {
    const { url, depth } = queue.shift()!;
    const normalized = normalizeUrl(url, {
      normalizeQuerystrings,
      removeHash: true,
    });
    if (!normalized) continue;
    if (visited.has(normalized)) continue;
    visited.add(normalized);

    // Robots.txt check
    if (robots && !robots.isAllowed(normalized, "SiteScanner/1.0")) continue;

    // Include/exclude filters
    if (includeRe && !includeRe.test(normalized)) continue;
    if (excludeRe && excludeRe.test(normalized)) continue;

    results.push({ url: normalized, depth });

    if (depth >= maxCrawlDepth) continue;

    // Fetch and extract links
    let html: string;
    try {
      const resp = await axios.get<string>(normalized, {
        timeout: 10000,
        responseType: "text",
        headers: {
          "User-Agent": "SiteScanner/1.0",
          "Accept": "text/html",
        },
        maxRedirects: 5,
        validateStatus: (s) => s < 400,
      });
      html = resp.data;
    } catch {
      continue;
    }

    const $ = cheerio.load(html);
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;
      const resolved = resolveUrl(href, normalized);
      if (!resolved) return;
      if (sameOriginOnly && !isSameOrigin(resolved, rootUrl)) return;
      if (!["http:", "https:"].includes(new URL(resolved).protocol)) return;

      const norm = normalizeUrl(resolved, { normalizeQuerystrings, removeHash: true });
      if (norm && !visited.has(norm)) {
        queue.push({ url: norm, depth: depth + 1 });
      }
    });
  }

  return results;
}
