import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { scanApi, pageApi } from "../api/client";
import { MetricCard, Card } from "../components/ui/Card";
import { StatusBadge, CdnBadge, CacheStateBadge } from "../components/ui/Badge";
import { CacheRatioDonut } from "../components/charts/CacheRatioDonut";
import { SkeletonCard } from "../components/ui/Skeleton";
import { ErrorState } from "../components/ui/EmptyState";
import { ProgressBar } from "../components/ui/ProgressBar";
import {
  formatMs, formatRatio, formatDate, lcpTrend, ttfbTrend
} from "../utils/format";
import { Brain, Layers, ArrowRight, FileSearch, ChevronDown, ChevronUp, ScrollText, Terminal } from "lucide-react";
import { Download, List, BarChart2, X } from "lucide-react";
import clsx from "clsx";
import type { Scan } from "../types";

function ScanActivityLog({ scanId }: { scanId: string }) {
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["scan-activity-log", scanId],
    queryFn: () => pageApi.list(scanId, { pageSize: 200, sortBy: "created_at", sortDir: "asc" }),
    enabled: open,
    staleTime: 60_000,
  });

  return (
    <Card padding="none">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-6 py-4 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors"
      >
        <ScrollText className="w-4 h-4 text-gray-400" />
        <h2 className="font-semibold text-gray-900">Scan Activity Log</h2>
        <span className="text-xs text-gray-400 ml-1">all pages processed in order</span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 ml-auto" /> : <ChevronDown className="w-4 h-4 text-gray-400 ml-auto" />}
      </button>

      {open && (
        <div className="border-t border-gray-100 overflow-x-auto">
          {isLoading ? (
            <div className="p-6 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-8 rounded bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-gray-500">#</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-500">URL</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-500">Status</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-500">HTTP</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-500">Cache</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-500">CDN</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-500">Cold TTFB</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-500">Warm TTFB</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-500">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 font-mono">
                {(data?.items ?? []).map((page, i) => (
                  <tr key={page.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-2 max-w-xs">
                      <span className="block truncate text-gray-700" title={page.original_url}>
                        {page.original_url.replace(/^https?:\/\/[^/]+/, "") || "/"}
                      </span>
                      {page.error_message && (
                        <span className="text-red-500 text-[10px]">{page.error_message.slice(0, 60)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <StatusBadge status={page.status} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      {page.http_status ? (
                        <span className={clsx(
                          "px-1.5 py-0.5 rounded font-medium",
                          page.http_status < 300 ? "bg-green-50 text-green-700" :
                          page.http_status < 400 ? "bg-yellow-50 text-yellow-700" :
                          "bg-red-50 text-red-700"
                        )}>{page.http_status}</span>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <CacheStateBadge state={page.cache_state} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <CdnBadge provider={page.cdn_provider} />
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {formatMs(page.cold_http?.ttfb_ms)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {formatMs(page.warmed_http?.ttfb_ms)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        to={`/scans/${scanId}/pages/${page.id}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </Card>
  );
}

interface ScanLogLine {
  ts?: number;
  level?: "info" | "warn" | "error" | "debug";
  msg?: string;
  component?: string;
  type?: "end";
}

const LEVEL_STYLES: Record<string, string> = {
  info:  "text-green-400",
  warn:  "text-yellow-400",
  error: "text-red-400",
  debug: "text-gray-500",
};

function formatLogTs(ts: number): string {
  const d = new Date(ts);
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}

function ScanLogTerminal({ scanId, isLive }: { scanId: string; isLive: boolean }) {
  const [open, setOpen] = useState(true);
  const [lines, setLines] = useState<ScanLogLine[]>([]);
  const [connected, setConnected] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const baseUrl = (import.meta.env.VITE_API_URL as string) || "";
    const url = `${baseUrl}/api/scans/${scanId}/logs`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => setConnected(true);

    es.onmessage = (evt) => {
      try {
        const line: ScanLogLine = JSON.parse(evt.data);
        if (line.type === "end") {
          setConnected(false);
          es.close();
          return;
        }
        setLines((prev) => [...prev, line]);
      } catch { /* ignore */ }
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [scanId]);

  // Auto-scroll to bottom when new lines arrive and panel is open
  useEffect(() => {
    if (open && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [lines, open]);

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950 shadow-lg mb-6 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-5 py-3 flex items-center gap-3 text-left hover:bg-gray-900 transition-colors"
      >
        <Terminal className="w-4 h-4 text-green-400 shrink-0" />
        <span className="font-mono text-sm font-semibold text-gray-100">Scan Log</span>
        {isLive && connected && (
          <span className="flex items-center gap-1.5 text-xs text-green-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            live
          </span>
        )}
        {!connected && lines.length > 0 && (
          <span className="text-xs text-gray-500">{lines.length} lines</span>
        )}
        {open
          ? <ChevronUp className="w-4 h-4 text-gray-500 ml-auto shrink-0" />
          : <ChevronDown className="w-4 h-4 text-gray-500 ml-auto shrink-0" />}
      </button>

      {/* Terminal body */}
      {open && (
        <div className="border-t border-gray-800 px-5 py-3 h-80 overflow-y-auto font-mono text-xs leading-relaxed">
          {lines.length === 0 ? (
            <p className="text-gray-600 italic">Waiting for log output...</p>
          ) : (
            lines.map((line, i) => (
              <div key={i} className="flex gap-3 group">
                <span className="text-gray-600 shrink-0 select-none w-16">
                  {line.ts ? formatLogTs(line.ts) : ""}
                </span>
                <span className={clsx("shrink-0 w-10 select-none", LEVEL_STYLES[line.level ?? "info"])}>
                  {(line.level ?? "info").toUpperCase().slice(0, 4)}
                </span>
                <span className="text-gray-200 break-all">{line.msg ?? ""}</span>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}

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

  // For single-URL scans with resource report, fetch the first page ID to link directly to page detail
  const { data: firstPageData } = useQuery({
    queryKey: ["scan-first-page", id],
    queryFn: () => pageApi.list(id!, { page: 1, pageSize: 1 }),
    enabled: !!id && scan?.mode === "single" && scan?.status === "completed" && scan?.settings.scanResources === true,
    staleTime: Infinity,
  });
  const firstPageId = firstPageData?.items[0]?.id;

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

      {/* Scan log terminal */}
      <ScanLogTerminal scanId={id!} isLive={isRunning} />

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

      {/* Scan Results CTA — for crawl/sitemap/list scans */}
      {scan.mode !== "single" && scan.status === "completed" && agg && agg.completed_pages > 0 && (
        <div className="relative overflow-hidden rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-blue-50/30 p-6 mb-6 shadow-sm">
          <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-blue-100/60 blur-2xl pointer-events-none" />
          <div className="relative flex items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-200">
                <FileSearch className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-base font-semibold text-blue-900">
                  {agg.completed_pages} page{agg.completed_pages !== 1 ? "s" : ""} scanned
                </p>
                <p className="text-sm text-blue-500 mt-0.5">
                  View individual cache states, performance metrics, and AI analysis per page
                </p>
              </div>
            </div>
            <Link
              to={`/scans/${id}/pages`}
              className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 active:scale-95 transition-all shadow-md shadow-blue-200"
            >
              View Results
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      {/* Resource Cache Report — prominent CTA for single-URL scans */}
      {scan.mode === "single" && scan.status === "completed" && scan.settings.scanResources && (
        <div className="relative overflow-hidden rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-indigo-50/30 p-6 mb-6 shadow-sm">
          {/* decorative blur blob */}
          <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-indigo-100/60 blur-2xl pointer-events-none" />
          <div className="relative flex items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-200">
                <Layers className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-base font-semibold text-indigo-900">Resource Cache Report ready</p>
                <p className="text-sm text-indigo-500 mt-0.5">
                  Per-resource breakdown for scripts, images, fonts &amp; all sub-resources loaded by the page
                </p>
              </div>
            </div>
            <Link
              to={firstPageId ? `/scans/${id}/pages/${firstPageId}` : `/scans/${id}/pages`}
              className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 active:scale-95 transition-all shadow-md shadow-indigo-200"
            >
              View Report
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
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
                ? `${scan.settings.aiProvider === "openai" ? "OpenAI / " : ""}${scan.settings.aiModel ?? "—"}`
                : "Off"}
            </p>
          </div>
          {scan.mode === "single" && (
            <div>
              <p className="text-xs text-gray-400">Resource report</p>
              <p className="font-medium">{scan.settings.scanResources ? "Yes" : "Off"}</p>
            </div>
          )}
          {scan.mode === "single" && scan.settings.debugHeaders && Object.keys(scan.settings.debugHeaders).length > 0 && (
            <div className="col-span-2">
              <p className="text-xs text-gray-400">Debug headers</p>
              <p className="font-mono text-xs text-orange-700 break-all">
                {Object.entries(scan.settings.debugHeaders).map(([k, v]) => `${k}: ${v}`).join(" · ")}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Resource report not enabled — subtle hint at the bottom */}
      {scan.mode === "single" && scan.status === "completed" && !scan.settings.scanResources && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500 flex items-start gap-3">
          <Layers className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-400" />
          <p>
            <span className="font-medium text-gray-600">Resource Cache Report not enabled.</span>{" "}
            Re-run with <span className="font-medium">Resource cache report</span> checked to get a per-resource
            breakdown of cache states for scripts, images, fonts, and other sub-resources.
          </p>
        </div>
      )}

      {/* Scan activity log */}
      {scan.status === "completed" && <ScanActivityLog scanId={id!} />}
    </div>
  );
}
