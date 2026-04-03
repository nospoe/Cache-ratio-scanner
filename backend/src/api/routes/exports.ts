import { Router, Request, Response } from "express";
import { format as csvFormat } from "fast-csv";
import { getScan } from "../../db/repositories/scanRepo";
import { getPageResults } from "../../db/repositories/pageRepo";
import { childLogger } from "../../utils/logger";

const router = Router({ mergeParams: true });
const log = childLogger("api.exports");

// GET /scans/:id/export.csv
router.get("/export.csv", async (req: Request, res: Response) => {
  const { id: scanId } = req.params;

  try {
    const scan = await getScan(scanId);
    if (!scan) return res.status(404).json({ error: "Scan not found" });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="scan-${scanId}.csv"`);

    const csvStream = csvFormat({ headers: true });
    csvStream.pipe(res);

    let page = 1;
    const pageSize = 100;

    while (true) {
      const { items } = await getPageResults(scanId, { page, pageSize });
      if (items.length === 0) break;

      for (const item of items) {
        const bm = item.browser_metrics as Record<string, unknown> | null;
        const ch = item.cold_http as Record<string, unknown> | null;
        csvStream.write({
          url: item.original_url,
          final_url: item.final_url,
          status: item.status,
          http_status: item.http_status,
          content_type: item.content_type,
          cdn_provider: item.cdn_provider,
          cdn_confidence: item.cdn_confidence,
          cache_state: item.cache_state,
          warm_outcome: item.warm_outcome,
          is_challenged: item.is_challenged,
          is_blocked: item.is_blocked,
          challenge_type: item.challenge_type,
          ttfb_ms: ch?.["ttfb_ms"] ?? "",
          latency_ms: ch?.["latency_ms"] ?? "",
          fcp_ms: bm?.["fcp_ms"] ?? "",
          lcp_ms: bm?.["lcp_ms"] ?? "",
          cls: bm?.["cls"] ?? "",
          tbt_ms: bm?.["tbt_ms"] ?? "",
          speed_index: bm?.["speed_index"] ?? "",
          total_bytes: bm?.["total_bytes"] ?? "",
          total_requests: bm?.["total_requests"] ?? "",
          js_bytes: bm?.["js_bytes"] ?? "",
          css_bytes: bm?.["css_bytes"] ?? "",
          image_bytes: bm?.["image_bytes"] ?? "",
          third_party_count: bm?.["third_party_count"] ?? "",
          performance_score: item.performance_score,
          cache_hit_ratio: item.cache_hit_ratio,
          recommendations_count: Array.isArray(item.recommendations) ? item.recommendations.length : 0,
        });
      }

      if (items.length < pageSize) break;
      page++;
    }

    csvStream.end();
  } catch (err) {
    log.error({ err, scanId }, "CSV export failed");
    if (!res.headersSent) {
      res.status(500).json({ error: "Export failed" });
    }
  }
});

// GET /scans/:id/export.json
router.get("/export.json", async (req: Request, res: Response) => {
  const { id: scanId } = req.params;

  try {
    const scan = await getScan(scanId);
    if (!scan) return res.status(404).json({ error: "Scan not found" });

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="scan-${scanId}.json"`);

    const allPages: unknown[] = [];
    let page = 1;
    const pageSize = 100;

    while (true) {
      const { items } = await getPageResults(scanId, { page, pageSize });
      if (items.length === 0) break;
      allPages.push(...items);
      if (items.length < pageSize) break;
      page++;
    }

    return res.json({
      scan: {
        id: scan.id,
        created_at: scan.created_at,
        mode: scan.mode,
        root_input: scan.root_input,
        settings: scan.settings,
        aggregate: scan.aggregate,
      },
      pages: allPages,
    });
  } catch (err) {
    log.error({ err, scanId }, "JSON export failed");
    return res.status(500).json({ error: "Export failed" });
  }
});

export default router;
