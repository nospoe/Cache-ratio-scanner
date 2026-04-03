import axios from "axios";
import { XMLParser } from "fast-xml-parser";
import { normalizeUrl } from "./urlNormalizer";

const parser = new XMLParser({ ignoreAttributes: false });

export async function fetchSitemap(
  sitemapUrl: string,
  maxUrls: number,
  visited = new Set<string>()
): Promise<string[]> {
  if (visited.has(sitemapUrl)) return [];
  visited.add(sitemapUrl);

  let xml: string;
  try {
    const resp = await axios.get<string>(sitemapUrl, {
      timeout: 15000,
      headers: { "User-Agent": "SiteScanner/1.0 Sitemap-Fetcher" },
      responseType: "text",
    });
    xml = resp.data;
  } catch {
    return [];
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = parser.parse(xml) as Record<string, unknown>;
  } catch {
    return [];
  }

  const urls: string[] = [];

  // Sitemap index: contains <sitemapindex><sitemap><loc>...</loc>
  const sitemapIndex = (parsed["sitemapindex"] as Record<string, unknown> | undefined);
  if (sitemapIndex) {
    const sitemaps = toArray(sitemapIndex["sitemap"]);
    for (const sitemap of sitemaps) {
      if (urls.length >= maxUrls) break;
      const loc = (sitemap as Record<string, unknown>)["loc"] as string | undefined;
      if (loc) {
        const sub = await fetchSitemap(loc, maxUrls - urls.length, visited);
        urls.push(...sub);
      }
    }
    return urls;
  }

  // Regular sitemap: contains <urlset><url><loc>...</loc>
  const urlset = (parsed["urlset"] as Record<string, unknown> | undefined);
  if (urlset) {
    const urlEntries = toArray(urlset["url"]);
    for (const entry of urlEntries) {
      if (urls.length >= maxUrls) break;
      const loc = (entry as Record<string, unknown>)["loc"] as string | undefined;
      if (loc) {
        const normalized = normalizeUrl(loc, { normalizeQuerystrings: false, removeHash: true });
        if (normalized) urls.push(normalized);
      }
    }
  }

  return [...new Set(urls)]; // deduplicate
}

function toArray<T>(val: T | T[] | undefined): T[] {
  if (Array.isArray(val)) return val;
  if (val !== undefined && val !== null) return [val];
  return [];
}
