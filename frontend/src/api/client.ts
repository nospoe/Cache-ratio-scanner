import axios from "axios";
import type {
  Scan,
  PageResult,
  PaginatedResult,
  CreateScanRequest,
  NormalizedCacheState,
} from "../types";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "",
  timeout: 30000,
});

export const scanApi = {
  create: (data: CreateScanRequest) =>
    api.post<{ id: string; status: string; mode: string; createdAt: string; jobId: string }>("/api/scans", data).then((r) => r.data),

  list: (page = 1, pageSize = 20) =>
    api.get<PaginatedResult<Scan>>(`/api/scans?page=${page}&pageSize=${pageSize}`).then((r) => r.data),

  get: (id: string) =>
    api.get<Scan>(`/api/scans/${id}`).then((r) => r.data),

  cancel: (id: string) =>
    api.delete<{ success: boolean }>(`/api/scans/${id}`).then((r) => r.data),

  exportCsv: (id: string) => {
    window.location.href = `${import.meta.env.VITE_API_URL || ""}/api/scans/${id}/export.csv`;
  },

  exportJson: (id: string) => {
    window.location.href = `${import.meta.env.VITE_API_URL || ""}/api/scans/${id}/export.json`;
  },
};

export const pageApi = {
  list: (
    scanId: string,
    options: {
      page?: number;
      pageSize?: number;
      sortBy?: string;
      sortDir?: "asc" | "desc";
      cdn?: string;
      cacheState?: NormalizedCacheState;
      status?: string;
      search?: string;
    } = {}
  ) => {
    const params = new URLSearchParams();
    if (options.page) params.set("page", String(options.page));
    if (options.pageSize) params.set("pageSize", String(options.pageSize));
    if (options.sortBy) params.set("sortBy", options.sortBy);
    if (options.sortDir) params.set("sortDir", options.sortDir);
    if (options.cdn) params.set("cdn", options.cdn);
    if (options.cacheState) params.set("cacheState", options.cacheState);
    if (options.status) params.set("status", options.status);
    if (options.search) params.set("search", options.search);
    return api
      .get<PaginatedResult<PageResult>>(`/api/scans/${scanId}/pages?${params}`)
      .then((r) => r.data);
  },

  get: (scanId: string, pageId: string) =>
    api.get<PageResult>(`/api/scans/${scanId}/pages/${pageId}`).then((r) => r.data),

  rankings: (scanId: string, metric = "lcp_ms", limit = 10) =>
    api
      .get<{ fastest: PageResult[]; slowest: PageResult[]; metric: string }>(
        `/api/scans/${scanId}/pages/rankings?metric=${metric}&limit=${limit}`
      )
      .then((r) => r.data),

  globalRankings: (metric = "lcp_ms", limit = 20) =>
    api
      .get<GlobalRankingsResponse>(`/api/pages/rankings?metric=${metric}&limit=${limit}`)
      .then((r) => r.data),
};

export interface GlobalPageResult extends PageResult {
  scan_root_input: string;
  scan_created_at: string;
}

export interface GlobalScanResult {
  id: string;
  root_input: string;
  created_at: string;
  overall_cache_hit_ratio: number;
  total_pages: number;
  completed_pages: number;
}

export type GlobalRankingsResponse =
  | { best: GlobalPageResult[]; worst: GlobalPageResult[]; metric: string; level: "page" }
  | { best: GlobalScanResult[]; worst: GlobalScanResult[]; metric: "cache_hit_ratio"; level: "scan" };
