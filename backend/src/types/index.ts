// ─── Scan-level types ───────────────────────────────────────────────────────

export type ScanMode = "single" | "list" | "sitemap" | "crawl";
export type ScanStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export type DeviceProfile = "desktop" | "mobile" | "custom";
export type InputType = "single_url" | "url_list" | "sitemap" | "crawl" | "csv";

export type AiModel = "gemma4:31b" | "gemma3:27b" | "gpt-oss:latest";

export interface ScanSettings {
  mode: ScanMode;
  deviceProfile: DeviceProfile;
  customViewport?: { width: number; height: number };
  customUserAgent?: string;
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
  includePattern?: string;
  excludePattern?: string;
  normalizeQuerystrings: boolean;
  headers?: Record<string, string>;
  basicAuth?: { username: string; password: string };
  scanPerformance: boolean;
  scanCache: boolean;
  aiCacheAnalysis: boolean;
  aiModel?: AiModel;
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
  // AI cache analysis aggregate (only present when aiCacheAnalysis was enabled)
  ai_pages_analyzed: number;
  ai_cached_count: number;
  avg_ai_cache_hit_ratio: number | null;
  avg_ai_confidence: number | null;
}

// ─── CDN types ───────────────────────────────────────────────────────────────

export type CdnProvider = "cloudflare" | "cloudfront" | "fastly" | "akamai" | "unknown";
export type CdnConfidence = "high" | "medium" | "low" | "none";

export type NormalizedCacheState =
  | "HIT"
  | "MISS"
  | "BYPASS"
  | "EXPIRED"
  | "REVALIDATED"
  | "STALE"
  | "DYNAMIC"
  | "ERROR"
  | "CHALLENGE"
  | "UNKNOWN";

export type WarmOutcome =
  | "warmed-hit"
  | "remained-miss"
  | "bypass"
  | "uncacheable"
  | "challenged"
  | "error-response";

export type ChallengeType =
  | "bot-challenge"
  | "waf-block"
  | "rate-limit"
  | "origin-error"
  | "cdn-error-page"
  | "uncached-dynamic"
  | "intentional-bypass";

// ─── HTTP probe types ─────────────────────────────────────────────────────────

export interface ProbeRecord {
  url: string;
  final_url: string;
  status_code: number;
  latency_ms: number;
  ttfb_ms: number;
  dns_ms: number | null;
  connect_ms: number | null;
  tls_ms: number | null;
  age_seconds: number | null;
  content_type: string | null;
  content_length: number | null;
  redirect_count: number;
  redirect_chain: string[];
  request_headers: Record<string, string>;
  response_headers: Record<string, string>;
  error?: string;
}

export interface CacheEvent {
  id?: string;
  page_result_id?: string;
  scan_id: string;
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

// ─── CDN detector output ──────────────────────────────────────────────────────

export interface CdnDetectorOutput {
  provider: CdnProvider;
  confidence: CdnConfidence;
  signals: string[];
  confidenceScore: number; // 0–1 numeric
}

// ─── Cache normalizer output ──────────────────────────────────────────────────

export interface CacheNormalizerOutput {
  cold_state: NormalizedCacheState;
  warmed_state: NormalizedCacheState;
  warm_outcome: WarmOutcome;
  cache_hit_ratio: number;
  cold_hit_ratio: number;
  warmed_hit_ratio: number;
  bypass_ratio: number;
  error_page_cache_ratio: number;
  non_200_cache_ratio: number;
}

// ─── Browser metrics ──────────────────────────────────────────────────────────

export interface WaterfallEntry {
  url: string;
  type: string;
  start_ms: number;
  duration_ms: number;
  size_bytes: number;
  is_third_party: boolean;
  is_render_blocking: boolean;
  status_code: number;
}

export interface BrowserMetrics {
  fcp_ms: number | null;
  lcp_ms: number | null;
  cls: number | null;
  tbt_ms: number | null;
  speed_index: number | null;
  ttfb_ms: number | null;
  fully_loaded_ms: number | null;
  dom_content_loaded_ms: number | null;
  total_requests: number;
  total_bytes: number;
  js_bytes: number;
  css_bytes: number;
  image_bytes: number;
  font_bytes: number;
  third_party_count: number;
  render_blocking_resources: string[];
  waterfall: WaterfallEntry[];
  performance_score: number;
  long_tasks_total_ms: number;
}

// ─── Challenge detector output ────────────────────────────────────────────────

export interface ChallengeDetectorOutput {
  is_challenged: boolean;
  is_blocked: boolean;
  challenge_type: ChallengeType | null;
  confidence: number;
  signals: string[];
}

// ─── AI Cache Analysis ────────────────────────────────────────────────────────

export interface AiCacheAnalysisResult {
  cached: boolean;
  reasoning: string;
  cache_hit_ratio: number; // 0–1
  confidence: number; // 0–1
  model: string;
}

// ─── Recommendation ───────────────────────────────────────────────────────────

export type RecommendationSeverity = "critical" | "warning" | "info";

export interface Recommendation {
  id: string;
  severity: RecommendationSeverity;
  category: "cache" | "performance" | "cdn" | "security";
  title: string;
  description: string;
  evidence?: string;
}

// ─── Page result ──────────────────────────────────────────────────────────────

export type PageStatus = "pending" | "running" | "completed" | "failed";

export interface PageResult {
  id: string;
  scan_id: string;
  created_at: string;
  original_url: string;
  final_url: string;
  crawl_depth: number;
  status: PageStatus;
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
  challenge_type: ChallengeType | null;
  recommendations: Recommendation[];
  performance_score: number | null;
  cache_hit_ratio: number | null;
  ai_cache_analysis: AiCacheAnalysisResult | null;
}

// ─── Plugin system ────────────────────────────────────────────────────────────

export interface PluginContext {
  url: string;
  crawlDepth: number;
  scanId: string;
  pageId: string;
  settings: ScanSettings;
}

export interface PageWorkingState {
  url: string;
  crawlDepth: number;
  scanId: string;
  pageId: string;
  settings: ScanSettings;
  coldProbe?: ProbeRecord;
  warmEvents: CacheEvent[];
  warmedProbe?: ProbeRecord;
  cdnDetector?: CdnDetectorOutput;
  cacheNormalizer?: CacheNormalizerOutput;
  browserMetrics?: BrowserMetrics;
  challengeDetector?: ChallengeDetectorOutput;
  aiCacheAnalysis?: AiCacheAnalysisResult;
  recommendations: Recommendation[];
  error?: string;
}

// ─── Job types ────────────────────────────────────────────────────────────────

export interface ScanJobPayload {
  scanId: string;
  rootInput: string;
  mode: ScanMode;
  settings: ScanSettings;
  urlList?: string[]; // pre-supplied URLs for list/csv mode
}

export interface ScanProgress {
  scanId: string;
  status: ScanStatus;
  total: number;
  completed: number;
  failed: number;
  currentUrl?: string;
  message?: string;
}

// ─── API request/response types ───────────────────────────────────────────────

export interface CreateScanRequest {
  mode: ScanMode;
  rootInput: string;
  urls?: string[];
  settings?: Partial<ScanSettings>;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
