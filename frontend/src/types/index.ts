export type ScanMode = "single" | "list" | "sitemap" | "crawl";
export type AiModel = string;
export type AiProvider = "openai" | "custom" | "anthropic";
export type ScanStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export type CdnProvider = "cloudflare" | "cloudfront" | "fastly" | "akamai" | "unknown";
export type CdnConfidence = "high" | "medium" | "low" | "none";
export type NormalizedCacheState =
  | "HIT" | "MISS" | "BYPASS" | "EXPIRED" | "REVALIDATED"
  | "STALE" | "DYNAMIC" | "ERROR" | "CHALLENGE" | "UNKNOWN";
export type WarmOutcome =
  | "warmed-hit" | "remained-miss" | "bypass"
  | "uncacheable" | "challenged" | "error-response";
export type RecommendationSeverity = "critical" | "warning" | "info";

export interface ScanSettings {
  mode: ScanMode;
  deviceProfile: "desktop" | "mobile" | "custom";
  concurrency: number;
  perHostConcurrency: number;
  maxPages: number;
  maxCrawlDepth: number;
  maxWarmAttempts: number;
  warmDelayMs: number;
  requestTimeoutMs: number;
  browserTimeoutMs: number;
  maxRedirects: number;
  crawlDelay: number;
  sameOriginOnly: boolean;
  respectRobotsTxt: boolean;
  normalizeQuerystrings: boolean;
  scanPerformance: boolean;
  scanCache: boolean;
  aiCacheAnalysis: boolean;
  aiProvider?: AiProvider;
  aiModel?: AiModel;
  aiExtraPrompt?: string;
  scanResources: boolean;
  debugHeaders?: Record<string, string>;
  includePattern?: string;
  excludePattern?: string;
}

export interface ScanAggregate {
  total_pages: number;
  completed_pages: number;
  failed_pages: number;
  challenged_pages: number;
  blocked_pages: number;
  cdn_distribution: Record<string, number>;
  avg_lcp_ms: number | null;
  median_lcp_ms: number | null;
  p95_lcp_ms: number | null;
  avg_ttfb_ms: number | null;
  overall_cache_hit_ratio: number | null;
  document_cache_hit_ratio: number | null;
  static_asset_cache_hit_ratio: number | null;
  bypass_count: number;
  non_cacheable_html_count: number;
  error_page_count: number;
  scan_duration_ms: number;
  ai_pages_analyzed: number;
  ai_cached_count: number;
  avg_ai_cache_hit_ratio: number | null;
  avg_ai_confidence: number | null;
}

export interface Scan {
  id: string;
  created_at: string;
  updated_at: string;
  status: ScanStatus;
  mode: ScanMode;
  root_input: string;
  settings: ScanSettings;
  aggregate?: ScanAggregate;
  job_id?: string;
  error_message?: string;
  progress?: ScanProgress;
}

export interface ScanProgress {
  status: string;
  total?: number;
  completed?: number;
  failed?: number;
  currentUrl?: string;
  message?: string;
}

export interface ResourceCacheResult {
  id: string;
  page_result_id: string;
  scan_id: string;
  url: string;
  resource_type: string;
  http_status: number | null;
  latency_ms: number | null;
  response_headers: Record<string, string>;
  cache_state: NormalizedCacheState | null;
  cdn_provider: CdnProvider | null;
  cdn_confidence: CdnConfidence | null;
  content_type: string | null;
  content_length: number | null;
  age_seconds: number | null;
  is_third_party: boolean;
}

export interface AiRecommendation {
  category: "performance" | "caching" | "security" | "cdn";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
}

export interface AiCacheAnalysisResult {
  cached: boolean;
  reasoning: string;
  cache_hit_ratio: number;
  confidence: number;
  model: string;
  inferred_cdn?: string | null;
  operator_ack?: string | null;
  recommendations?: AiRecommendation[];
}

export interface Recommendation {
  id: string;
  severity: RecommendationSeverity;
  category: "cache" | "performance" | "cdn" | "security";
  title: string;
  description: string;
  evidence?: string;
}

export interface BrowserMetrics {
  fcp_ms: number | null;
  lcp_ms: number | null;
  cls: number | null;
  tbt_ms: number | null;
  speed_index: number | null;
  ttfb_ms: number | null;
  fully_loaded_ms: number | null;
  total_requests: number;
  total_bytes: number;
  js_bytes: number;
  css_bytes: number;
  image_bytes: number;
  font_bytes: number;
  third_party_count: number;
  render_blocking_resources: string[];
  performance_score: number;
  long_tasks_total_ms: number;
}

export interface ProbeRecord {
  url: string;
  final_url: string;
  status_code: number;
  latency_ms: number;
  ttfb_ms: number;
  age_seconds: number | null;
  content_type: string | null;
  redirect_count: number;
  redirect_chain: string[];
  request_headers?: Record<string, string>;
  response_headers: Record<string, string>;
}

export interface CacheEvent {
  id: string;
  page_result_id: string;
  request_num: number;
  phase: "cold" | "warm" | "final";
  http_status: number;
  latency_ms: number;
  age_seconds: number | null;
  cache_state: NormalizedCacheState;
  raw_cache_headers: Record<string, string>;
  eligible: boolean;
  ineligible_reason?: string;
}

export interface PageResult {
  id: string;
  scan_id: string;
  original_url: string;
  final_url: string;
  crawl_depth: number;
  status: "pending" | "running" | "completed" | "failed";
  http_status: number | null;
  content_type: string | null;
  error_message?: string;
  cdn_provider: CdnProvider | null;
  cdn_confidence: CdnConfidence | null;
  cdn_signals: string[];
  cdn_confidence_score: number | null;
  cache_state: NormalizedCacheState | null;
  warm_outcome: WarmOutcome | null;
  cold_http: ProbeRecord | null;
  warmed_http: ProbeRecord | null;
  browser_metrics: BrowserMetrics | null;
  raw_response_headers: Record<string, string>;
  is_challenged: boolean;
  is_blocked: boolean;
  challenge_type: string | null;
  recommendations: Recommendation[];
  performance_score: number | null;
  cache_hit_ratio: number | null;
  ai_cache_analysis: AiCacheAnalysisResult | null;
  cacheEvents?: CacheEvent[];
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreateScanRequest {
  mode: ScanMode;
  rootInput: string;
  urls?: string[];
  settings?: Partial<ScanSettings>;
}
