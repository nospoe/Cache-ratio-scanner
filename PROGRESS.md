# Site Scanner — Build Progress

## Status: v1.0 Complete

All core features implemented and ready for `docker-compose up`.

---

## Phase 1 — Infrastructure ✅
- `docker-compose.yml` — postgres, redis, api, worker, frontend containers
- `backend/Dockerfile` — Node 22 + Playwright Chromium
- `frontend/Dockerfile` — Vite build → nginx
- PostgreSQL migrations (001–004): scans, page_results, cache_events, audit_log
- BullMQ scan queue with Redis
- DB connection pool, migration runner
- Structured logging (pino)
- SSRF protection (ipaddr.js + async DNS resolution)

## Phase 2 — Crawler + HTTP Probe + CDN Adapters ✅
- **Crawler** (`plugins/crawler/`):
  - Sitemap fetcher with sitemap-index support
  - BFS link crawler with robots.txt, depth/regex/origin controls
  - URL normalizer with canonical dedup
- **HTTP Probe** (`plugins/httpProbe/`):
  - Cold probe with full timing
  - Cache warming loop (warmingStrategy.ts) — detects HIT, Age increase, bypass, error
  - Configurable max attempts and delay
- **CDN Adapters** (`plugins/cdnDetector/adapters/`):
  - Cloudflare (CF-Ray, CF-Cache-Status, cf-mitigated)
  - CloudFront (x-amz-cf-id, x-amz-cf-pop, x-cache)
  - Fastly (x-served-by, x-timer, x-cache)
  - Akamai (x-akamai-request-id, TCP_HIT patterns, x-cache-key)
  - Fallback with confidence score for unknown CDNs
- **Cache Normalizer** (`plugins/cacheNormalizer/`):
  - Maps CDN-specific states to: HIT/MISS/BYPASS/EXPIRED/REVALIDATED/STALE/DYNAMIC/ERROR/CHALLENGE/UNKNOWN
  - Ratio calculator from cache_events: hit ratio, cold/warm ratios, bypass ratio, error-page ratio

## Phase 3 — Browser Collection + Challenge Detection + Recommendations ✅
- **Browser Collector** (`plugins/browserCollector/`):
  - Playwright Chromium (headless)
  - PerformanceObserver injection for LCP, CLS, long tasks
  - FCP from paint entries, TBT from long tasks
  - Resource collector: bytes by type (JS/CSS/img/font), third-party count, render-blocking
  - Waterfall capture via request/response events
  - Simplified performance score (LCP/FCP/TBT/CLS weighted)
  - Desktop and mobile device profiles
- **Challenge Detector** (`plugins/challengeDetector/`):
  - Heuristic scoring: status codes, cf-mitigated, body patterns (Just a moment, CAPTCHA, etc.)
  - Content-type mismatch detection
  - Short HTML body detection for challenge pages
  - 8+ challenge signals with weighted scoring
- **Recommendation Engine** (`plugins/recommendationEngine/rules/`):
  - Cache rules: CACHE-001–CACHE-008 (no-cache HTML, Vary:*, Set-Cookie, short TTL, etc.)
  - Performance rules: PERF-001–PERF-008 (slow LCP, TBT, CLS, render-blocking, JS weight)
  - CDN rules: CDN-001–CDN-005 (unknown CDN, cookies fragmenting cache, challenge pages, HTTP)

## Phase 4 — Scan Orchestrator + Batch Runner + API ✅
- **Scan Orchestrator** (`scan/scanOrchestrator.ts`):
  - Plugin pipeline: httpProbe → cdnDetector → cacheNormalizer → challengeDetector → browserCollector → recommendations
  - Persists page_results and cache_events to PostgreSQL
- **Batch Runner** (`scan/batchRunner.ts`):
  - Semaphore-based global + per-host concurrency
  - Cancellation via Redis key check
  - Progress callback
- **Aggregate Builder** (`scan/aggregateBuilder.ts`):
  - All dashboard metrics computed via SQL aggregations
- **API** (`api/routes/`):
  - POST /api/scans — create + queue
  - GET /api/scans — paginated list
  - GET /api/scans/:id — scan + live progress
  - DELETE /api/scans/:id — cancel
  - GET /api/scans/:id/progress — SSE progress stream
  - GET /api/scans/:id/pages — paginated, sortable, filterable
  - GET /api/scans/:id/pages/rankings — top fastest/slowest
  - GET /api/scans/:id/pages/:pageId — full page detail + cache events
  - GET /api/scans/:id/export.csv — streaming CSV
  - GET /api/scans/:id/export.json — full JSON
- **Worker** (`worker/worker.ts`):
  - BullMQ worker: crawl → batch → aggregate
  - Audit logging on start/complete/fail

## Phase 5 — Frontend ✅
- **React + Vite + Tailwind CSS + TanStack Query + Recharts**
- New Scan form (all 4 modes, advanced settings, device profiles)
- Scan List with auto-refresh for active scans
- Scan Dashboard with aggregate metrics, CDN distribution, cache ratio donut
- Page Rankings — sortable/filterable table (LCP, TTFB, bytes, requests, cache ratio)
- Page Detail — full breakdown: performance, caching, CDN signals, cache event timeline, headers, recommendations
- Settings/Help page

---

## Acceptance Criteria Status

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Single-page scan with performance + cache diagnostics | ✅ |
| 2 | Multi-page crawl with fastest/slowest rankings | ✅ |
| 3 | Cache warming before measurement, warmed outcome visible | ✅ |
| 4 | Cache ratio from observed hits/misses (cache_events table) | ✅ |
| 5 | Cloudflare, Fastly, CloudFront, Akamai adapters | ✅ |
| 6 | Challenge/block/error-page detection | ✅ |
| 7 | Docker Compose startup | ✅ |
| 8 | Filterable/sortable UI with per-page detail drill-down | ✅ |
| 9 | CSV and JSON export | ✅ |
| 10 | Unknown CDN graceful degradation with confidence indicator | ✅ |

---

## File Count Summary
- Backend: ~45 TypeScript source files
- Frontend: ~25 TypeScript/TSX source files
- Infrastructure: docker-compose.yml, 2 Dockerfiles, 4 SQL migrations, .env.example

## Known Limitations / Future Work
- PDF export (nice-to-have, v1.1)
- Historical scan comparison (v1.1)
- Authenticated scan support (v1.1)
- HAR export (v1.1)
- INP metric when Playwright exposes it natively
- Scheduled recurring scans (v1.1)
