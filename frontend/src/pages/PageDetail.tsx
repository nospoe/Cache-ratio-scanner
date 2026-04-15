import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { pageApi } from "../api/client";
import { Card, MetricCard } from "../components/ui/Card";
import { CacheStateBadge, EffectiveCacheStateBadge, CdnBadge, StatusBadge, SeverityBadge } from "../components/ui/Badge";
import { SkeletonCard } from "../components/ui/Skeleton";
import { ErrorState } from "../components/ui/EmptyState";
import { CacheRatioDonut } from "../components/charts/CacheRatioDonut";
import {
  formatMs, formatBytes, formatRatio, formatDate,
  lcpTrend, ttfbTrend, clsTrend, tbtTrend,
} from "../utils/format";
import { ChevronLeft, AlertTriangle, CheckCircle, Info } from "lucide-react";
import type { CacheEvent, Recommendation, AiCacheAnalysisResult } from "../types";
import clsx from "clsx";

function CacheEventsTable({ events }: { events: CacheEvent[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">#</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Phase</th>
            <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500">Status</th>
            <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500">Cache State</th>
            <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500">Age</th>
            <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500">Latency</th>
            <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500">Eligible</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {events.map((e) => (
            <tr key={e.id} className="hover:bg-gray-50">
              <td className="px-3 py-2 text-gray-500">{e.request_num}</td>
              <td className="px-3 py-2">
                <span className={clsx(
                  "text-xs font-medium px-1.5 py-0.5 rounded",
                  e.phase === "cold" ? "bg-blue-50 text-blue-700" :
                  e.phase === "warm" ? "bg-yellow-50 text-yellow-700" :
                  "bg-green-50 text-green-700"
                )}>
                  {e.phase}
                </span>
              </td>
              <td className="px-3 py-2 text-center">{e.http_status}</td>
              <td className="px-3 py-2 text-center">
                <CacheStateBadge state={e.cache_state} />
              </td>
              <td className="px-3 py-2 text-center text-gray-600">
                {e.age_seconds != null ? `${e.age_seconds}s` : "—"}
              </td>
              <td className="px-3 py-2 text-center text-gray-600">{formatMs(e.latency_ms)}</td>
              <td className="px-3 py-2 text-center">
                {e.eligible ? (
                  <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                ) : (
                  <span className="text-xs text-gray-400">{e.ineligible_reason ?? "no"}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AiCacheAnalysisCard({ result }: { result: AiCacheAnalysisResult }) {
  const hitPct = Math.round(result.cache_hit_ratio * 100);
  const confPct = Math.round(result.confidence * 100);

  return (
    <Card padding="none">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
        <h2 className="font-semibold text-gray-900">AI Cache Analysis</h2>
        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
          {result.model}
        </span>
        <span className={clsx(
          "text-xs px-2 py-0.5 rounded-full font-medium ml-auto",
          result.cached ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
        )}>
          {result.cached ? "Cached" : "Not cached"}
        </span>
      </div>
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">AI-estimated cache hit ratio</p>
            <p className="text-2xl font-bold text-gray-900">{hitPct}%</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Analysis confidence</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-100 rounded-full h-2">
                <div
                  className={clsx(
                    "h-2 rounded-full",
                    confPct >= 70 ? "bg-green-500" : confPct >= 40 ? "bg-yellow-400" : "bg-red-400"
                  )}
                  style={{ width: `${confPct}%` }}
                />
              </div>
              <span className="text-sm font-medium text-gray-700">{confPct}%</span>
            </div>
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Reasoning</p>
          <p className="text-sm text-gray-700 leading-relaxed">{result.reasoning}</p>
        </div>
      </div>
    </Card>
  );
}

function RecommendationItem({ rec }: { rec: Recommendation }) {
  const icon = {
    critical: <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />,
    warning: <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />,
    info: <Info className="w-4 h-4 text-blue-400 shrink-0" />,
  }[rec.severity];

  return (
    <div className="flex gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
      {icon}
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-medium text-gray-900">{rec.title}</p>
          <SeverityBadge severity={rec.severity} />
          <span className="text-xs text-gray-400">{rec.id}</span>
        </div>
        <p className="text-xs text-gray-600">{rec.description}</p>
        {rec.evidence && (
          <p className="text-xs text-gray-400 mt-1 font-mono">{rec.evidence}</p>
        )}
      </div>
    </div>
  );
}

function HeaderTable({ headers }: { headers: Record<string, string> }) {
  const entries = Object.entries(headers);
  if (entries.length === 0) return <p className="text-sm text-gray-400">No headers</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono">
        <tbody>
          {entries.map(([k, v]) => (
            <tr key={k} className="border-b border-gray-50">
              <td className="py-1 pr-4 text-gray-500 font-medium whitespace-nowrap">{k}</td>
              <td className="py-1 text-gray-700 break-all">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PageDetail() {
  const { id: scanId, pageId } = useParams<{ id: string; pageId: string }>();

  const { data: page, isLoading, isError, refetch } = useQuery({
    queryKey: ["page", scanId, pageId],
    queryFn: () => pageApi.get(scanId!, pageId!),
    enabled: !!scanId && !!pageId,
  });

  if (isLoading) {
    return (
      <div className="px-6 py-8 grid grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (isError || !page) {
    return (
      <div className="px-6 py-8">
        <ErrorState message="Failed to load page details" retry={() => refetch()} />
      </div>
    );
  }

  const bm = page.browser_metrics;
  const ch = page.cold_http;
  const wh = page.warmed_http;

  return (
    <div className="px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link to={`/scans/${scanId}/pages`} className="text-gray-400 hover:text-gray-600 mt-1">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900 break-all">{page.original_url}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <StatusBadge status={page.status} />
            {page.http_status && (
              <span className={clsx(
                "text-xs font-mono px-2 py-0.5 rounded-full font-medium",
                page.http_status < 300 ? "bg-green-100 text-green-700" :
                page.http_status < 400 ? "bg-yellow-100 text-yellow-700" :
                "bg-red-100 text-red-700"
              )}>
                HTTP {page.http_status}
              </span>
            )}
            <CdnBadge provider={page.cdn_provider} confidence={page.cdn_confidence} />
            <EffectiveCacheStateBadge state={page.cache_state} aiAnalysis={page.ai_cache_analysis} />
            {page.warm_outcome && (
              <span className="text-xs text-gray-500">
                Warm: <span className="font-medium">{page.warm_outcome}</span>
              </span>
            )}
            {page.is_challenged && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                Challenged
              </span>
            )}
          </div>
        </div>
      </div>

      {page.error_message && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          Error: {page.error_message}
        </div>
      )}

      {/* Overview grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">CDN Provider</p>
          <CdnBadge provider={page.cdn_provider} confidence={page.cdn_confidence} />
          {page.cdn_confidence_score != null && (
            <p className="text-xs text-gray-400 mt-0.5">
              Confidence: {Math.round(page.cdn_confidence_score * 100)}%
            </p>
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Content Type</p>
          <p className="text-sm font-mono text-gray-700">{page.content_type ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Final URL</p>
          <p className="text-sm text-gray-700 break-all">{page.final_url || page.original_url}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Cache Hit Ratio</p>
          <p className="text-2xl font-bold text-gray-900">{formatRatio(page.cache_hit_ratio)}</p>
        </div>
      </div>

      {/* Performance section */}
      {bm && (
        <Card padding="none">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Performance Metrics</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <MetricCard label="LCP" value={bm.lcp_ms != null ? Math.round(bm.lcp_ms) : null} unit="ms" trend={lcpTrend(bm.lcp_ms)} />
              <MetricCard label="FCP" value={bm.fcp_ms != null ? Math.round(bm.fcp_ms) : null} unit="ms" trend={lcpTrend(bm.fcp_ms)} />
              <MetricCard label="TBT" value={bm.tbt_ms != null ? Math.round(bm.tbt_ms) : null} unit="ms" trend={tbtTrend(bm.tbt_ms)} />
              <MetricCard label="CLS" value={bm.cls} trend={clsTrend(bm.cls)} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <MetricCard label="TTFB" value={bm.ttfb_ms != null ? Math.round(bm.ttfb_ms) : null} unit="ms" trend={ttfbTrend(bm.ttfb_ms)} />
              <MetricCard label="Speed Index" value={bm.speed_index != null ? Math.round(bm.speed_index) : null} unit="ms" />
              <MetricCard label="Requests" value={bm.total_requests} />
              <MetricCard label="Total Size" value={bm.total_bytes != null ? formatBytes(bm.total_bytes) : null} />
            </div>
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">JS</p>
                <p className="text-sm font-medium">{formatBytes(bm.js_bytes)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">CSS</p>
                <p className="text-sm font-medium">{formatBytes(bm.css_bytes)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Images</p>
                <p className="text-sm font-medium">{formatBytes(bm.image_bytes)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Third-party requests</p>
                <p className="text-sm font-medium">{bm.third_party_count}</p>
              </div>
            </div>
            {bm.render_blocking_resources.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Render-blocking resources</p>
                <ul className="space-y-1">
                  {bm.render_blocking_resources.map((url) => (
                    <li key={url} className="text-xs text-gray-600 font-mono truncate">{url}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Caching section */}
      <Card padding="none">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">CDN Cache Analysis</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div>
              <CacheRatioDonut hitRatio={page.cache_hit_ratio} title="Cache Hit Ratio" />
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Cold state</p>
                <div className="flex items-center gap-2">
                  <CacheStateBadge state={ch ? page.cache_state : null} />
                  {ch?.age_seconds != null && (
                    <span className="text-xs text-gray-400">Age: {ch.age_seconds}s</span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Warmed state</p>
                <div className="flex items-center gap-2">
                  <EffectiveCacheStateBadge state={page.cache_state} aiAnalysis={page.ai_cache_analysis} />
                  <span className="text-xs text-gray-500">{page.warm_outcome}</span>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">CDN Signals</p>
                {page.cdn_signals?.length > 0 ? (
                  <ul className="space-y-0.5">
                    {page.cdn_signals.map((s, i) => (
                      <li key={i} className="text-xs font-mono text-gray-600">{s}</li>
                    ))}
                  </ul>
                ) : <p className="text-xs text-gray-400">No signals</p>}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Timing comparison</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Cold TTFB</span>
                  <span>{formatMs(ch?.ttfb_ms)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Warmed TTFB</span>
                  <span>{formatMs(wh?.ttfb_ms)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Cold latency</span>
                  <span>{formatMs(ch?.latency_ms)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Warmed latency</span>
                  <span>{formatMs(wh?.latency_ms)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Cache events timeline */}
          {page.cacheEvents && page.cacheEvents.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">Cache Event Timeline</p>
              <div className="border border-gray-100 rounded-lg overflow-hidden">
                <CacheEventsTable events={page.cacheEvents} />
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* AI cache analysis */}
      {page.ai_cache_analysis && (
        <AiCacheAnalysisCard result={page.ai_cache_analysis} />
      )}

      {/* Response headers */}
      <Card padding="none">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Response Headers</h2>
        </div>
        <div className="p-6">
          <HeaderTable headers={page.raw_response_headers} />
        </div>
      </Card>

      {/* Challenge/block */}
      {(page.is_challenged || page.is_blocked) && (
        <Card className="border-red-200 bg-red-50" padding="md">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-800 mb-1">
                {page.is_challenged ? "Challenge page detected" : "Blocked response detected"}
              </p>
              <p className="text-sm text-red-700">
                Type: {page.challenge_type ?? "Unknown"}.{" "}
                This page appears to be serving a security challenge or block response.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Recommendations */}
      {page.recommendations.length > 0 && (
        <Card padding="none">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">
              Recommendations
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({page.recommendations.length})
              </span>
            </h2>
          </div>
          <div className="p-6 space-y-3">
            {page.recommendations.map((rec) => (
              <RecommendationItem key={rec.id} rec={rec} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
