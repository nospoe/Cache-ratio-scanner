import { Router, Request, Response } from "express";
import { getGlobalTopPages } from "../../db/repositories/pageRepo";
import { getGlobalTopScansByCacheRatio } from "../../db/repositories/scanRepo";
import { childLogger } from "../../utils/logger";

const router = Router();
const log = childLogger("api.globalRankings");

const VALID_METRICS = ["lcp_ms", "ttfb_ms", "cache_hit_ratio"] as const;
type Metric = typeof VALID_METRICS[number];

// GET /api/pages/rankings?metric=lcp_ms&limit=20
router.get("/rankings", async (req: Request, res: Response) => {
  const metric = (req.query.metric as string) || "lcp_ms";
  const limit = Math.min(parseInt(String(req.query.limit ?? "20")), 100);

  if (!VALID_METRICS.includes(metric as Metric)) {
    return res.status(400).json({ error: `Invalid metric. Use: ${VALID_METRICS.join(", ")}` });
  }

  try {
    if (metric === "cache_hit_ratio") {
      // Rank scans by their aggregate cache hit ratio; higher ratio = better
      const [best, worst] = await Promise.all([
        getGlobalTopScansByCacheRatio("desc", limit),
        getGlobalTopScansByCacheRatio("asc", limit),
      ]);
      return res.json({ best, worst, metric, level: "scan" });
    }

    // For lcp_ms / ttfb_ms: lower value = better
    const [best, worst] = await Promise.all([
      getGlobalTopPages(metric as Metric, "asc", limit),
      getGlobalTopPages(metric as Metric, "desc", limit),
    ]);
    return res.json({ best, worst, metric, level: "page" });
  } catch (err) {
    log.error({ err }, "Failed to get global rankings");
    return res.status(500).json({ error: "Failed to get global rankings" });
  }
});

export default router;
