import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { pageApi } from "../api/client";
import type { PageResult } from "../types";
import { CacheStateBadge, CdnBadge } from "../components/ui/Badge";
import { formatMs, formatBytes } from "../utils/format";
import { ChevronLeft, TrendingUp, TrendingDown } from "lucide-react";
import clsx from "clsx";

type Metric = "lcp_ms" | "ttfb_ms" | "cache_hit_ratio";

const METRICS: { key: Metric; label: string; unit: string }[] = [
  { key: "lcp_ms", label: "LCP", unit: "ms" },
  { key: "ttfb_ms", label: "TTFB", unit: "ms" },
  { key: "cache_hit_ratio", label: "Cache Hit Ratio", unit: "%" },
];

function formatMetric(value: number | null | undefined, metric: Metric): string {
  if (value == null) return "—";
  if (metric === "cache_hit_ratio") return `${Math.round(value * 100)}%`;
  return formatMs(value);
}

function metricColor(value: number | null | undefined, metric: Metric): string {
  if (value == null) return "text-gray-400";
  if (metric === "lcp_ms") {
    if (value <= 2500) return "text-green-600";
    if (value <= 4000) return "text-yellow-600";
    return "text-red-600";
  }
  if (metric === "ttfb_ms") {
    if (value <= 600) return "text-green-600";
    if (value <= 1500) return "text-yellow-600";
    return "text-red-600";
  }
  if (metric === "cache_hit_ratio") {
    if (value >= 0.8) return "text-green-600";
    if (value >= 0.5) return "text-yellow-600";
    return "text-red-600";
  }
  return "text-gray-700";
}

function getMetricValue(page: PageResult, metric: Metric): number | null {
  if (metric === "lcp_ms") return page.browser_metrics?.lcp_ms ?? null;
  if (metric === "ttfb_ms") return page.cold_http?.ttfb_ms ?? null;
  if (metric === "cache_hit_ratio") return page.cache_hit_ratio;
  return null;
}

function RankRow({
  page,
  scanId,
  rank,
  metric,
}: {
  page: PageResult;
  scanId: string;
  rank: number;
  metric: Metric;
}) {
  const value = getMetricValue(page, metric);
  let pathname = "/";
  try { pathname = new URL(page.original_url).pathname || "/"; } catch { /* ok */ }

  return (
    <Link
      to={`/scans/${scanId}/pages/${page.id}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
    >
      <span className="w-6 text-center text-xs font-bold text-gray-400">{rank}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{pathname}</p>
        <p className="text-xs text-gray-400 truncate">{page.original_url}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <CdnBadge provider={page.cdn_provider} />
        <CacheStateBadge state={page.cache_state} />
        <span className={clsx("text-sm font-semibold w-20 text-right", metricColor(value, metric))}>
          {formatMetric(value, metric)}
        </span>
      </div>
    </Link>
  );
}

export default function PageRankingsView() {
  const { id: scanId } = useParams<{ id: string }>();
  const [metric, setMetric] = useState<Metric>("lcp_ms");

  const { data, isLoading } = useQuery({
    queryKey: ["rankings", scanId, metric],
    queryFn: () => pageApi.rankings(scanId!, metric, 10),
    enabled: !!scanId,
  });

  const metricLabel = METRICS.find((m) => m.key === metric)?.label ?? metric;

  return (
    <div className="px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/scans/${scanId}`} className="text-gray-400 hover:text-gray-600">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Performance Rankings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Top 10 best and worst pages by metric</p>
        </div>
      </div>

      {/* Metric selector */}
      <div className="flex gap-1 border border-gray-200 rounded-lg p-1 bg-white w-fit mb-6">
        {METRICS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setMetric(key)}
            className={clsx(
              "px-4 py-1.5 text-sm font-medium rounded-md transition-colors",
              metric === key
                ? "bg-blue-600 text-white"
                : "text-gray-600 hover:bg-gray-50"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-sm text-gray-400 py-8 text-center">Loading rankings…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Best */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-green-50">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span className="text-sm font-semibold text-green-700">
                Best {metricLabel}
              </span>
            </div>
            {data?.fastest.length === 0 ? (
              <p className="text-sm text-gray-400 px-4 py-6 text-center">No data</p>
            ) : (
              data?.fastest.map((page, i) => (
                <RankRow key={page.id} page={page} scanId={scanId!} rank={i + 1} metric={metric} />
              ))
            )}
          </div>

          {/* Worst */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-red-50">
              <TrendingDown className="w-4 h-4 text-red-600" />
              <span className="text-sm font-semibold text-red-700">
                Worst {metricLabel}
              </span>
            </div>
            {data?.slowest.length === 0 ? (
              <p className="text-sm text-gray-400 px-4 py-6 text-center">No data</p>
            ) : (
              data?.slowest.map((page, i) => (
                <RankRow key={page.id} page={page} scanId={scanId!} rank={i + 1} metric={metric} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
