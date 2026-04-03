import type { ScanMode, ScanSettings } from "../../types";
import { fetchSitemap } from "./sitemapFetcher";
import { crawlDomain } from "./linkCrawler";
import { normalizeUrl } from "./urlNormalizer";
import { childLogger } from "../../utils/logger";

const log = childLogger("crawler");

export interface CrawledUrl {
  url: string;
  depth: number;
}

export async function resolveUrls(
  mode: ScanMode,
  rootInput: string,
  settings: ScanSettings,
  suppliedUrls?: string[]
): Promise<CrawledUrl[]> {
  log.info({ mode, rootInput }, "Resolving URLs");

  switch (mode) {
    case "single": {
      const norm = normalizeUrl(rootInput, {
        normalizeQuerystrings: settings.normalizeQuerystrings,
        removeHash: true,
      });
      return norm ? [{ url: norm, depth: 0 }] : [];
    }

    case "list": {
      const urls = suppliedUrls ?? rootInput.split("\n").map((u) => u.trim()).filter(Boolean);
      const result: CrawledUrl[] = [];
      for (const u of urls) {
        const norm = normalizeUrl(u, {
          normalizeQuerystrings: settings.normalizeQuerystrings,
          removeHash: true,
        });
        if (norm) result.push({ url: norm, depth: 0 });
      }
      // deduplicate
      const seen = new Set<string>();
      return result.filter(({ url }) => {
        if (seen.has(url)) return false;
        seen.add(url);
        return true;
      }).slice(0, settings.maxPages);
    }

    case "sitemap": {
      const sitemapUrls = await fetchSitemap(rootInput, settings.maxPages);
      log.info({ count: sitemapUrls.length }, "Sitemap URLs resolved");
      return sitemapUrls.map((url) => ({ url, depth: 0 })).slice(0, settings.maxPages);
    }

    case "crawl": {
      const results = await crawlDomain(rootInput, settings);
      log.info({ count: results.length }, "Crawl complete");
      return results.slice(0, settings.maxPages);
    }

    default:
      log.warn({ mode }, "Unknown scan mode");
      return [];
  }
}
