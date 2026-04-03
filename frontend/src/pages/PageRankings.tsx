import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { pageApi } from "../api/client";
import type { PageResult, NormalizedCacheState } from "../types";
import { CacheStateBadge, CdnBadge, StatusBadge } from "../components/ui/Badge";
import { SkeletonTable } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { formatMs, formatRatio, formatBytes } from "../utils/format";
import { ArrowUp, ArrowDown, ArrowRight, ChevronLeft } from "lucide-react";
import clsx from "clsx";

type SortKey = "lcp_ms" | "ttfb_ms" | "total_bytes" | "total_requests" | "cache_hit_ratio";
type SortDir = "asc" | "desc";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "lcp_ms", label: "LCP" },
  { key: "ttfb_ms", label: "TTFB" },
  { key: "total_bytes", label: "Size" },
  { key: "total_requests", label: "Requests" },
  { key: "cache_hit_ratio", label: "Cache Hit" },
];

const CDN_OPTIONS = ["cloudflare", "cloudfront", "fastly", "akamai", "unknown"];
const CACHE_STATES: NormalizedCacheState[] = [
  "HIT", "MISS", "BYPASS", "EXPIRED", "DYNAMIC", "ERROR", "CHALLENGE", "UNKNOWN",
];

function PageRow({ page, scanId, metric }: { page: PageResult; scanId: string; metric: SortKey }) {
  const bm = page.browser_metrics;
  const ch = page.cold_http;

  const metricValue = {
    lcp_ms: bm?.lcp_ms != null ? formatMs(bm.lcp_ms) : "—",
    ttfb_ms: ch?.ttfb_ms != null ? formatMs(ch.ttfb_ms) : "—",
    total_bytes: bm?.total_bytes != null ? formatBytes(bm.total_bytes) : "—",
    total_requests: bm?.total_requests != null ? String(bm.total_requests) : "—",
    cache_hit_ratio: page.cache_hit_ratio != null ? formatRatio(page.cache_hit_ratio) : "—",
  }[metric];

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <div className="max-w-xs">
          <Link
            to={`/scans/${scanId}/pages/${page.id}`}
            className="text-sm font-medium text-blue-600 hover:text-blue-700 truncate block"
          >
            {new URL(page.original_url).pathname || "/"}
          </Link>
          <p className="text-xs text-gray-400 truncate">{page.original_url}</p>
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        <StatusBadge status={page.status} />
      </td>
      <td className="px-4 py-3 text-center">
        <CdnBadge provider={page.cdn_provider} confidence={page.cdn_confidence} />
      </td>
      <td className="px-4 py-3 text-center">
        <CacheStateBadge state={page.cache_state} />
      </td>
      <td className="px-4 py-3 text-center text-sm font-semibold text-gray-900">
        {metricValue}
      </td>
      <td className="px-4 py-3 text-center text-sm">
        {bm?.performance_score != null ? (
          <span className={clsx(
            "font-semibold",
            bm.performance_score >= 90 ? "text-green-600" :
            bm.performance_score >= 50 ? "text-yellow-600" : "text-red-600"
          )}>
            {Math.round(bm.performance_score)}
          </span>
        ) : "—"}
      </td>
      <td className="px-4 py-3 text-right">
        <Link to={`/scans/${scanId}/pages/${page.id}`} className="text-gray-400 hover:text-gray-600">
          <ArrowRight className="w-4 h-4" />
        </Link>
      </td>
    </tr>
  );
}

export default function PageRankings() {
  const { id: scanId } = useParams<{ id: string }>();
  const [sortBy, setSortBy] = useState<SortKey>("lcp_ms");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterCdn, setFilterCdn] = useState("");
  const [filterCacheState, setFilterCacheState] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["pages", scanId, { sortBy, sortDir, filterCdn, filterCacheState, search, page }],
    queryFn: () =>
      pageApi.list(scanId!, {
        page,
        pageSize: 50,
        sortBy,
        sortDir,
        cdn: filterCdn || undefined,
        cacheState: filterCacheState as NormalizedCacheState || undefined,
        search: search || undefined,
      }),
    enabled: !!scanId,
  });

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("desc");
    }
    setPage(1);
  };

  return (
    <div className="px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/scans/${scanId}`} className="text-gray-400 hover:text-gray-600">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Page Rankings</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data?.total ?? 0} pages · sorted by {sortBy}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search URLs..."
          className="input w-64"
        />
        <select
          value={filterCdn}
          onChange={(e) => { setFilterCdn(e.target.value); setPage(1); }}
          className="input w-40"
        >
          <option value="">All CDNs</option>
          {CDN_OPTIONS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={filterCacheState}
          onChange={(e) => { setFilterCacheState(e.target.value); setPage(1); }}
          className="input w-40"
        >
          <option value="">All cache states</option>
          {CACHE_STATES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* Sort buttons */}
        <div className="flex gap-1 border border-gray-200 rounded-lg p-1 bg-white">
          {SORT_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => handleSort(key)}
              className={clsx(
                "flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-md transition-colors",
                sortBy === key
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-50"
              )}
            >
              {label}
              {sortBy === key && (
                sortDir === "desc"
                  ? <ArrowDown className="w-3 h-3" />
                  : <ArrowUp className="w-3 h-3" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">URL</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">CDN</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Cache</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide capitalize">
                {SORT_OPTIONS.find((o) => o.key === sortBy)?.label}
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Score</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              <tr><td colSpan={7}><SkeletonTable rows={10} /></td></tr>
            ) : data?.items.length === 0 ? (
              <tr><td colSpan={7}><EmptyState title="No pages found" description="Try adjusting your filters." /></td></tr>
            ) : (
              data?.items.map((page) => (
                <PageRow key={page.id} page={page} scanId={scanId!} metric={sortBy} />
              ))
            )}
          </tbody>
        </table>

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">Page {page} of {data.totalPages} · {data.total} pages</p>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="btn-secondary text-xs py-1 px-3 disabled:opacity-40">Previous</button>
              <button onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages}
                className="btn-secondary text-xs py-1 px-3 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
