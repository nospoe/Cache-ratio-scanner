import { Router, Request, Response } from "express";
import {
  getPageResult,
  getPageResults,
  getTopPagesByMetric,
} from "../../db/repositories/pageRepo";
import { getCacheEvents } from "../../db/repositories/cacheEventRepo";
import { getResourceCacheResults } from "../../db/repositories/resourceRepo";
import type { NormalizedCacheState } from "../../types";
import { childLogger } from "../../utils/logger";

const router = Router({ mergeParams: true });
const log = childLogger("api.pages");

// GET /scans/:id/pages
router.get("/", async (req: Request, res: Response) => {
  const { id: scanId } = req.params;
  const page = parseInt(String(req.query.page ?? "1"));
  const pageSize = Math.min(parseInt(String(req.query.pageSize ?? "50")), 200);
  const sortBy = String(req.query.sortBy ?? "created_at");
  const sortDir = req.query.sortDir === "desc" ? "desc" : "asc";
  const filterCdn = req.query.cdn ? String(req.query.cdn) : undefined;
  const filterCacheState = req.query.cacheState ? String(req.query.cacheState) : undefined;
  const filterStatus = req.query.status ? String(req.query.status) : undefined;
  const search = req.query.search ? String(req.query.search) : undefined;

  try {
    const result = await getPageResults(scanId, {
      page,
      pageSize,
      sortBy,
      sortDir,
      filterCdn,
      filterCacheState: filterCacheState as NormalizedCacheState | undefined,
      filterStatus,
      search,
    });

    return res.json({
      items: result.items,
      total: result.total,
      page,
      pageSize,
      totalPages: Math.ceil(result.total / pageSize),
    });
  } catch (err) {
    log.error({ err, scanId }, "Failed to get pages");
    return res.status(500).json({ error: "Failed to get pages" });
  }
});

// GET /scans/:id/pages/rankings
router.get("/rankings", async (req: Request, res: Response) => {
  const { id: scanId } = req.params;
  const metric = (req.query.metric as string) || "lcp_ms";
  const limit = Math.min(parseInt(String(req.query.limit ?? "10")), 50);

  const validMetrics = ["lcp_ms", "ttfb_ms", "cache_hit_ratio"];
  if (!validMetrics.includes(metric)) {
    return res.status(400).json({ error: `Invalid metric. Use: ${validMetrics.join(", ")}` });
  }

  try {
    const [fastest, slowest] = await Promise.all([
      getTopPagesByMetric(scanId, metric as "lcp_ms" | "ttfb_ms" | "cache_hit_ratio", "asc", limit),
      getTopPagesByMetric(scanId, metric as "lcp_ms" | "ttfb_ms" | "cache_hit_ratio", "desc", limit),
    ]);

    return res.json({ fastest, slowest, metric });
  } catch (err) {
    log.error({ err, scanId }, "Failed to get rankings");
    return res.status(500).json({ error: "Failed to get rankings" });
  }
});

// GET /scans/:id/pages/:pageId
router.get("/:pageId", async (req: Request, res: Response) => {
  const { pageId } = req.params;

  try {
    const [page, events] = await Promise.all([
      getPageResult(pageId),
      getCacheEvents(pageId),
    ]);

    if (!page) return res.status(404).json({ error: "Page not found" });

    return res.json({ ...page, cacheEvents: events });
  } catch (err) {
    log.error({ err, pageId }, "Failed to get page");
    return res.status(500).json({ error: "Failed to get page" });
  }
});

// GET /scans/:id/pages/:pageId/resources
router.get("/:pageId/resources", async (req: Request, res: Response) => {
  const { pageId } = req.params;

  try {
    const resources = await getResourceCacheResults(pageId);
    return res.json(resources);
  } catch (err) {
    log.error({ err, pageId }, "Failed to get resource cache results");
    return res.status(500).json({ error: "Failed to get resource cache results" });
  }
});

export default router;
