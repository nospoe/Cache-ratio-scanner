import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { scanApi } from "../api/client";
import { MetricCard, Card } from "../components/ui/Card";
import { StatusBadge, CdnBadge } from "../components/ui/Badge";
import { CacheRatioDonut } from "../components/charts/CacheRatioDonut";
import { SkeletonCard } from "../components/ui/Skeleton";
import { ErrorState } from "../components/ui/EmptyState";
import { ProgressBar } from "../components/ui/ProgressBar";
import {
  formatMs, formatRatio, formatDate, lcpTrend, ttfbTrend
} from "../utils/format";
import { Brain } from "lucide-react";
import { Download, List, BarChart2, X } from "lucide-react";
import clsx from "clsx";
import type { Scan } from "../types";

function ScanProgressCard({ scan }: { scan: Scan }) {
  const progress = scan.progress;
  const total = progress?.total ?? 0;
  const completed = progress?.completed ?? 0;
  const pct = total > 0 ? (completed / total) * 100 : 0;

  return (
    <Card className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {progress?.message ?? (scan.status === "queued" ? "Queued..." : "Scanning...")}
          </p>
          {progress?.currentUrl && (
            <p className="text-xs text-gray-400 mt-0.5 max-w-lg truncate">
              {progress.currentUrl}
            </p>
          )}
        </div>
        <StatusBadge status={scan.status} />
      </div>
      <ProgressBar value={pct} showLabel />
      {total > 0 && (
        <p className="text-xs text-gray-400 mt-2">
          {completed} / {total} pages · {progress?.failed ?? 0} failed
        </p>
      )}
    </Card>
  );
}

export default function ScanDashboard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: scan, isLoading, isError, refetch } = useQuery({
    queryKey: ["scan", id],
    queryFn: () => scanApi.get(id!),
    refetchInterval: (q) => {
      const s = q.state.data;
      return s?.status === "running" || s?.status === "queued" ? 3000 : false;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="px-6 py-8 grid grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (isError || !scan) {
    return (
      <div className="px-6 py-8">
        <ErrorState message="Failed to load scan" retry={() => refetch()} />
      </div>
    );
  }

  const agg = scan.aggregate;
  const isRunning = scan.status === "running" || scan.status === "queued";

  return (
    <div className="px-6 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span className="max-w-lg truncate">{scan.root_input}</span>
            <StatusBadge status={scan.status} />
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            {scan.mode} · {formatDate(scan.created_at)}
            {agg?.scan_duration_ms && (
              <> · completed in {formatMs(agg.scan_duration_ms)}</>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {scan.status === "completed" && (
            <>
              <button onClick={() => scanApi.exportCsv(id!)} className="btn-secondary text-xs">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
              <button onClick={() => scanApi.exportJson(id!)} className="btn-secondary text-xs">
                <Download className="w-3.5 h-3.5" /> JSON
              </button>
            </>
          )}
          {isRunning && (
            <button
              onClick={async () => {
                if (confirm("Cancel this scan?")) {
                  await scanApi.cancel(id!);
                  refetch();
                }
              }}
              className="btn-secondary text-xs text-red-600 hover:text-red-700"
            >
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
          )}
          <Link to={`/scans/${id}/pages`} className="btn-secondary text-xs">
            <List className="w-3.5 h-3.5" /> Pages
          </Link>
          <Link to={`/scans/${id}/rankings`} className="btn-secondary text-xs">
            <BarChart2 className="w-3.5 h-3.5" /> Rankings
          </Link>
        </div>
      </div>

      {/* Progress card for active scans */}
      {isRunning && <ScanProgressCard scan={scan} />}

      {/* Error state */}
      {scan.status === "failed" && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700 mb-6">
          Scan failed: {scan.error_message}
        </div>
      )}

      {/* Aggregate metrics */}
      {agg && (
        <>
          {/* Overview row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <MetricCard label="Pages Scanned" value={agg.total_pages} />
            <MetricCard label="Completed" value={agg.completed_pages} trend="good" />
            <MetricCard
              label="Failed"
              value={agg.failed_pages}
              trend={agg.failed_pages > 0 ? "bad" : "neutral"}
            />
            <MetricCard
              label="Challenged"
              value={agg.challenged_pages}
              trend={agg.challenged_pages > 0 ? "warn" : "neutral"}
            />
          </div>

          {/* Performance row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <MetricCard
              label="Avg LCP"
              value={agg.avg_lcp_ms != null ? Math.round(agg.avg_lcp_ms) : null}
              unit="ms"
              trend={lcpTrend(agg.avg_lcp_ms)}
              description="Largest Contentful Paint"
            />
            <MetricCard
              label="Median LCP"
              value={agg.median_lcp_ms != null ? Math.round(agg.median_lcp_ms) : null}
              unit="ms"
              trend={lcpTrend(agg.median_lcp_ms)}
            />
            <MetricCard
              label="P95 LCP"
              value={agg.p95_lcp_ms != null ? Math.round(agg.p95_lcp_ms) : null}
              unit="ms"
              trend={lcpTrend(agg.p95_lcp_ms)}
            />
            <MetricCard
              label="Avg TTFB"
              value={agg.avg_ttfb_ms != null ? Math.round(agg.avg_ttfb_ms) : null}
              unit="ms"
              trend={ttfbTrend(agg.avg_ttfb_ms)}
              description="Time To First Byte"
            />
          </div>

          {/* Cache + CDN row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CacheRatioDonut hitRatio={agg.overall_cache_hit_ratio} title="Overall Cache Hit Ratio" />
            </Card>
            <Card>
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    Cache Breakdown
                  </p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Document (HTML)</span>
                      <span className="font-medium">{formatRatio(agg.document_cache_hit_ratio)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Static Assets</span>
                      <span className="font-medium">{formatRatio(agg.static_asset_cache_hit_ratio)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Bypass pages</span>
                      <span className="font-medium text-yellow-600">{agg.bypass_count}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Non-cacheable HTML</span>
                      <span className="font-medium text-red-600">{agg.non_cacheable_html_count}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
            <Card>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
                CDN Distribution
              </p>
              {Object.keys(agg.cdn_distribution).length === 0 ? (
                <p className="text-sm text-gray-400">No CDN data</p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(agg.cdn_distribution)
                    .sort(([, a], [, b]) => b - a)
                    .map(([provider, count]) => (
                      <div key={provider} className="flex items-center justify-between">
                        <CdnBadge provider={provider as never} />
                        <span className="text-sm text-gray-600">{count} pages</span>
                      </div>
                    ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}

      {/* AI cache analysis summary */}
      {scan.settings.aiCacheAnalysis && agg && (
        <Card className="border-purple-100 bg-purple-50/40">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-4 h-4 text-purple-600" />
            <p className="text-sm font-semibold text-purple-900">AI Cache Analysis</p>
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
              {scan.settings.aiModel ?? "gemma3:27b"}
            </span>
          </div>
          {agg.ai_pages_analyzed === 0 ? (
            <p className="text-sm text-purple-600">No pages were successfully analysed by AI yet.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-purple-500 mb-0.5">Pages analysed</p>
                <p className="font-semibold text-purple-900">{agg.ai_pages_analyzed}</p>
              </div>
              <div>
                <p className="text-xs text-purple-500 mb-0.5">AI-judged cached</p>
                <p className="font-semibold text-purple-900">{agg.ai_cached_count}</p>
              </div>
              <div>
                <p className="text-xs text-purple-500 mb-0.5">Avg AI hit ratio</p>
                <p className="font-semibold text-purple-900">{formatRatio(agg.avg_ai_cache_hit_ratio)}</p>
              </div>
              <div>
                <p className="text-xs text-purple-500 mb-0.5">Avg confidence</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 bg-purple-100 rounded-full h-1.5">
                    <div
                      className={clsx(
                        "h-1.5 rounded-full",
                        (agg.avg_ai_confidence ?? 0) >= 0.7 ? "bg-green-500" :
                        (agg.avg_ai_confidence ?? 0) >= 0.4 ? "bg-yellow-400" : "bg-red-400"
                      )}
                      style={{ width: `${Math.round((agg.avg_ai_confidence ?? 0) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-purple-900">
                    {Math.round((agg.avg_ai_confidence ?? 0) * 100)}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Settings summary */}
      <Card>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Scan Settings</p>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-400">Device</p>
            <p className="font-medium">{scan.settings.deviceProfile}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Max pages</p>
            <p className="font-medium">{scan.settings.maxPages}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Warm attempts</p>
            <p className="font-medium">{scan.settings.maxWarmAttempts}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Concurrency</p>
            <p className="font-medium">{scan.settings.concurrency}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Performance</p>
            <p className="font-medium">{scan.settings.scanPerformance ? "Yes" : "No"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Cache analysis</p>
            <p className="font-medium">{scan.settings.scanCache ? "Yes" : "No"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">AI analysis</p>
            <p className="font-medium">
              {scan.settings.aiCacheAnalysis
                ? (scan.settings.aiModel ?? "gemma3:27b")
                : "Off"}
            </p>
          </div>
          {scan.mode === "single" && (
            <div>
              <p className="text-xs text-gray-400">Resource report</p>
              <p className="font-medium">{scan.settings.scanResources ? "Yes" : "Off"}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Resource report hint for single-URL scans */}
      {scan.mode === "single" && scan.status === "completed" && (
        <div className={clsx(
          "rounded-lg border p-4 text-sm flex items-start gap-3",
          scan.settings.scanResources
            ? "border-indigo-100 bg-indigo-50/40 text-indigo-800"
            : "border-gray-200 bg-gray-50 text-gray-500"
        )}>
          <div className="flex-1">
            {scan.settings.scanResources ? (
              <>
                <p className="font-medium mb-0.5">Resource Cache Report available</p>
                <p className="text-xs">
                  Cache state breakdown for all sub-resources (scripts, images, fonts, etc.) is available on the{" "}
                  <Link to={`/scans/${id}/pages`} className="underline font-medium">Page Detail</Link>{" "}
                  view — click into the scanned page to see it.
                </p>
              </>
            ) : (
              <>
                <p className="font-medium mb-0.5">Resource Cache Report not enabled</p>
                <p className="text-xs">
                  Re-run this scan with <span className="font-medium">Resource cache report</span> checked to get
                  a per-resource breakdown of cache states for all scripts, images, fonts, and other sub-resources
                  loaded by the page.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
