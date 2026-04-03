import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { pageApi, type GlobalPageResult, type GlobalScanResult } from "../api/client";
import { CacheStateBadge, CdnBadge } from "../components/ui/Badge";
import { formatMs, formatDistanceToNow } from "../utils/format";
import { TrendingUp, TrendingDown } from "lucide-react";
import clsx from "clsx";

type Metric = "lcp_ms" | "ttfb_ms" | "cache_hit_ratio";

const METRICS: { key: Metric; label: string }[] = [
  { key: "lcp_ms", label: "LCP" },
  { key: "ttfb_ms", label: "TTFB" },
  { key: "cache_hit_ratio", label: "Cache Hit Ratio" },
];

function formatMetric(page: GlobalPageResult, metric: Metric): string {
  if (metric === "lcp_ms") return page.browser_metrics?.lcp_ms != null ? formatMs(page.browser_metrics.lcp_ms) : "—";
  if (metric === "ttfb_ms") return page.cold_http?.ttfb_ms != null ? formatMs(page.cold_http.ttfb_ms) : "—";
  if (metric === "cache_hit_ratio") return page.cache_hit_ratio != null ? `${Math.round(page.cache_hit_ratio * 100)}%` : "—";
  return "—";
}

function metricColor(page: GlobalPageResult, metric: Metric): string {
  if (metric === "lcp_ms") {
    const v = page.browser_metrics?.lcp_ms;
    if (v == null) return "text-gray-400";
    return v <= 2500 ? "text-green-600" : v <= 4000 ? "text-yellow-600" : "text-red-600";
  }
  if (metric === "ttfb_ms") {
    const v = page.cold_http?.ttfb_ms;
    if (v == null) return "text-gray-400";
    return v <= 600 ? "text-green-600" : v <= 1500 ? "text-yellow-600" : "text-red-600";
  }
  if (metric === "cache_hit_ratio") {
    const v = page.cache_hit_ratio;
    if (v == null) return "text-gray-400";
    return v >= 0.8 ? "text-green-600" : v >= 0.5 ? "text-yellow-600" : "text-red-600";
  }
  return "text-gray-700";
}

function RankTable({
  pages,
  metric,
  title,
  icon,
  headerClass,
  iconClass,
}: {
  pages: GlobalPageResult[];
  metric: Metric;
  title: string;
  icon: React.ReactNode;
  headerClass: string;
  iconClass: string;
}) {
  if (pages.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className={`flex items-center gap-2 px-4 py-3 border-b border-gray-100 ${headerClass}`}>
          <span className={iconClass}>{icon}</span>
          <span className="text-sm font-semibold">{title}</span>
        </div>
        <p className="text-sm text-gray-400 px-4 py-8 text-center">No data yet — run some scans first.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className={`flex items-center gap-2 px-4 py-3 border-b border-gray-100 ${headerClass}`}>
        <span className={iconClass}>{icon}</span>
        <span className={`text-sm font-semibold ${iconClass}`}>{title}</span>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-50 bg-gray-50/50">
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 w-8">#</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-400">Page</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-400">Scan</th>
            <th className="px-4 py-2 text-center text-xs font-medium text-gray-400">CDN</th>
            <th className="px-4 py-2 text-center text-xs font-medium text-gray-400">Cache</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-gray-400">Value</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {pages.map((page, i) => {
            let pathname = "/";
            try { pathname = new URL(page.original_url).pathname || "/"; } catch { /* ok */ }
            return (
              <tr key={page.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-2.5 text-xs font-bold text-gray-300">{i + 1}</td>
                <td className="px-4 py-2.5 min-w-0 max-w-xs">
                  <Link
                    to={`/scans/${page.scan_id}/pages/${page.id}`}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700 truncate block"
                    title={page.original_url}
                  >
                    {pathname}
                  </Link>
                  <p className="text-xs text-gray-400 truncate">{page.original_url}</p>
                </td>
                <td className="px-4 py-2.5 min-w-0">
                  <Link
                    to={`/scans/${page.scan_id}`}
                    className="text-xs text-gray-500 hover:text-blue-600 truncate block max-w-[140px]"
                    title={page.scan_root_input}
                  >
                    {page.scan_root_input}
                  </Link>
                  <p className="text-xs text-gray-300">{formatDistanceToNow(page.scan_created_at)} ago</p>
                </td>
                <td className="px-4 py-2.5 text-center">
                  <CdnBadge provider={page.cdn_provider} />
                </td>
                <td className="px-4 py-2.5 text-center">
                  <CacheStateBadge state={page.cache_state} />
                </td>
                <td className={clsx("px-4 py-2.5 text-right text-sm font-semibold", metricColor(page, metric))}>
                  {formatMetric(page, metric)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ScanRankTable({
  scans,
  title,
  icon,
  headerClass,
  iconClass,
}: {
  scans: GlobalScanResult[];
  title: string;
  icon: React.ReactNode;
  headerClass: string;
  iconClass: string;
}) {
  if (scans.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className={`flex items-center gap-2 px-4 py-3 border-b border-gray-100 ${headerClass}`}>
          <span className={iconClass}>{icon}</span>
          <span className="text-sm font-semibold">{title}</span>
        </div>
        <p className="text-sm text-gray-400 px-4 py-8 text-center">No data yet — run some scans first.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className={`flex items-center gap-2 px-4 py-3 border-b border-gray-100 ${headerClass}`}>
        <span className={iconClass}>{icon}</span>
        <span className={`text-sm font-semibold ${iconClass}`}>{title}</span>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-50 bg-gray-50/50">
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 w-8">#</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-400">Scan</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-400">Date</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-gray-400">Pages</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-gray-400">Cache Hit Ratio</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {scans.map((scan, i) => {
            const ratio = scan.overall_cache_hit_ratio;
            const ratioColor = ratio >= 0.8 ? "text-green-600" : ratio >= 0.5 ? "text-yellow-600" : "text-red-600";
            return (
              <tr key={scan.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-2.5 text-xs font-bold text-gray-300">{i + 1}</td>
                <td className="px-4 py-2.5 min-w-0">
                  <Link
                    to={`/scans/${scan.id}`}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700 truncate block max-w-xs"
                    title={scan.root_input}
                  >
                    {scan.root_input}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap">
                  {formatDistanceToNow(scan.created_at)} ago
                </td>
                <td className="px-4 py-2.5 text-right text-xs text-gray-500">
                  {scan.completed_pages}/{scan.total_pages}
                </td>
                <td className={clsx("px-4 py-2.5 text-right text-sm font-semibold", ratioColor)}>
                  {Math.round(ratio * 100)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function GlobalRankings() {
  const [metric, setMetric] = useState<Metric>("lcp_ms");

  const { data, isLoading } = useQuery({
    queryKey: ["globalRankings", metric],
    queryFn: () => pageApi.globalRankings(metric, 20),
  });

  const metricLabel = METRICS.find((m) => m.key === metric)?.label ?? metric;

  return (
    <div className="px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Global Rankings</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {metric === "cache_hit_ratio"
              ? "Best and worst scans by overall cache hit ratio"
              : "Best and worst pages across all scans"}
          </p>
        </div>

        {/* Metric selector */}
        <div className="flex gap-1 border border-gray-200 rounded-lg p-1 bg-white">
          {METRICS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setMetric(key)}
              className={clsx(
                "px-4 py-1.5 text-sm font-medium rounded-md transition-colors",
                metric === key ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-gray-400 py-12 text-center">Loading global rankings…</div>
      ) : data?.level === "scan" ? (
        <div className="space-y-6">
          <ScanRankTable
            scans={data.best as GlobalScanResult[]}
            title={`Best ${metricLabel} — top 20 scans`}
            icon={<TrendingUp className="w-4 h-4" />}
            headerClass="bg-green-50"
            iconClass="text-green-600"
          />
          <ScanRankTable
            scans={data.worst as GlobalScanResult[]}
            title={`Worst ${metricLabel} — bottom 20 scans`}
            icon={<TrendingDown className="w-4 h-4" />}
            headerClass="bg-red-50"
            iconClass="text-red-600"
          />
        </div>
      ) : (
        <div className="space-y-6">
          <RankTable
            pages={(data?.best ?? []) as GlobalPageResult[]}
            metric={metric}
            title={`Best ${metricLabel} — top 20 across all scans`}
            icon={<TrendingUp className="w-4 h-4" />}
            headerClass="bg-green-50"
            iconClass="text-green-600"
          />
          <RankTable
            pages={(data?.worst ?? []) as GlobalPageResult[]}
            metric={metric}
            title={`Worst ${metricLabel} — bottom 20 across all scans`}
            icon={<TrendingDown className="w-4 h-4" />}
            headerClass="bg-red-50"
            iconClass="text-red-600"
          />
        </div>
      )}
    </div>
  );
}
