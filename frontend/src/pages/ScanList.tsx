import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { scanApi } from "../api/client";
import type { Scan } from "../types";
import { StatusBadge } from "../components/ui/Badge";
import { SkeletonRow } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { Plus, ArrowRight, Globe, RotateCcw } from "lucide-react";
import { formatDistanceToNow } from "../utils/format";

function ScanRow({ scan, onRestart }: { scan: Scan; onRestart: (scan: Scan) => void }) {
  const aggregate = scan.aggregate;
  const [restarting, setRestarting] = useState(false);

  const handleRestart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setRestarting(true);
    try {
      await onRestart(scan);
    } finally {
      setRestarting(false);
    }
  };

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-gray-400 shrink-0" />
          <div>
            <Link
              to={`/scans/${scan.id}`}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 block max-w-xs truncate"
            >
              {scan.root_input}
            </Link>
            <p className="text-xs text-gray-400 mt-0.5">
              {scan.mode} · {formatDistanceToNow(scan.created_at)} ago
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        <StatusBadge status={scan.status} />
      </td>
      <td className="px-4 py-3 text-center text-sm text-gray-600">
        {aggregate?.total_pages ?? "—"}
      </td>
      <td className="px-4 py-3 text-center text-sm">
        {aggregate?.avg_lcp_ms != null ? (
          <span className={lcpColor(aggregate.avg_lcp_ms)}>
            {Math.round(aggregate.avg_lcp_ms)}ms
          </span>
        ) : "—"}
      </td>
      <td className="px-4 py-3 text-center text-sm">
        {aggregate?.overall_cache_hit_ratio != null ? (
          <span className="text-gray-700">
            {Math.round(aggregate.overall_cache_hit_ratio * 100)}%
          </span>
        ) : "—"}
      </td>
      <td className="px-4 py-3 text-center text-sm">
        {aggregate != null && aggregate.total_pages > 0 ? (
          <span className={errorRateColor(aggregate.error_page_count / aggregate.total_pages)}>
            {Math.round((aggregate.error_page_count / aggregate.total_pages) * 100)}%
          </span>
        ) : "—"}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={handleRestart}
            disabled={restarting}
            title="Restart scan with same settings"
            className="text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-40"
          >
            <RotateCcw className={`w-4 h-4 ${restarting ? "animate-spin" : ""}`} />
          </button>
          <Link to={`/scans/${scan.id}`} className="text-gray-400 hover:text-gray-600">
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </td>
    </tr>
  );
}

function lcpColor(ms: number) {
  if (ms <= 2500) return "text-green-600";
  if (ms <= 4000) return "text-yellow-600";
  return "text-red-600";
}

function errorRateColor(rate: number) {
  if (rate === 0) return "text-green-600";
  if (rate <= 0.05) return "text-yellow-600";
  return "text-red-600";
}

export default function ScanList() {
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleRestart = async (scan: Scan) => {
    const result = await scanApi.create({
      mode: scan.mode,
      rootInput: scan.root_input,
      settings: scan.settings,
    });
    await queryClient.invalidateQueries({ queryKey: ["scans"] });
    navigate(`/scans/${result.id}`);
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["scans", page],
    queryFn: () => scanApi.list(page, 20),
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? [];
      return items.some((s: Scan) => s.status === "running" || s.status === "queued") ? 5000 : false;
    },
  });

  return (
    <div className="px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Scan History</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data?.total ?? 0} total scans
          </p>
        </div>
        <Link to="/scans/new" className="btn-primary">
          <Plus className="w-4 h-4" />
          New Scan
        </Link>
      </div>

      {isError && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700 mb-4">
          Failed to load scans.{" "}
          <button onClick={() => refetch()} className="underline">Retry</button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Target
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Status
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Pages
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Avg LCP
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Cache Hit
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Errors
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              : data?.items.length === 0
              ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      title="No scans yet"
                      description="Start your first scan to analyze website performance and CDN cache behavior."
                      action={
                        <Link to="/scans/new" className="btn-primary">
                          <Plus className="w-4 h-4" /> New Scan
                        </Link>
                      }
                    />
                  </td>
                </tr>
              )
              : data?.items.map((scan) => <ScanRow key={scan.id} scan={scan} onRestart={handleRestart} />)}
          </tbody>
        </table>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Page {page} of {data.totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary text-xs py-1 px-3 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page === data.totalPages}
                className="btn-secondary text-xs py-1 px-3 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
