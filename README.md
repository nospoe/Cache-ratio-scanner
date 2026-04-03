# Site Scanner

> **Vibecoded** with Claude. A web performance and CDN cache scanner that actually warms the cache before measuring it.

Most tools fire one HTTP request and read the cache header. Site Scanner does something smarter: it makes a cold request, warms the CDN cache with follow-up requests, then measures real browser performance on the warmed URL. The result is a much more accurate picture of what your users actually experience.

---

## What it does

- Scans single URLs, lists of URLs, sitemaps, or entire domains via crawling
- Detects your CDN (Cloudflare, CloudFront, Fastly, Akamai) automatically
- Measures cold vs. warmed cache states per page
- Runs a real browser (Playwright) to collect LCP, FCP, CLS, TBT, TTFB
- Ranks pages across scans so you can spot your worst offenders
- Exports results as CSV or JSON
- Generates actionable recommendations (critical / warning / info)

---

## Quick start

You need **Docker** and **Docker Compose**. That's it.

```bash
git clone <this-repo>
cd site-scanner
cp .env.example .env      # tweak if needed, defaults work out of the box
docker compose up
```

Open **http://localhost:3000** and start scanning.

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| API | http://localhost:3001 |

To stop:

```bash
docker compose down
```

---

## Scan modes

| Mode | When to use |
|---|---|
| **Single URL** | Deep dive into one page |
| **URL List** | Paste a custom list of URLs |
| **Sitemap** | Auto-discover pages from `sitemap.xml` |
| **Crawl** | Follow links from a root URL up to a configurable depth |

---

## What you can configure per scan

| Setting | Default | Notes |
|---|---|---|
| Device profile | Desktop | Desktop, Mobile (iPhone), or Custom viewport |
| Max pages | 100 | Up to 500 |
| Concurrency | 3 | Parallel pages (1–10) |
| Max crawl depth | 3 | How deep to follow links |
| Warm attempts | 5 | Requests to fire per page to warm the cache |
| Warm delay | 500ms | Delay between warm requests |
| Same origin only | On | Ignore external links during crawl |
| Respect robots.txt | On | Honor crawl rules |
| Include / exclude | — | Regex patterns to filter URLs |
| Custom headers | — | Auth tokens, cookies, etc. |
| Basic auth | — | Username + password |
| Performance scan | On | Collect browser metrics |
| Cache scan | On | Collect cache probe data |

---

## Pages and features

### Scan list
All your past and running scans with status and quick stats.

### Scan dashboard
Aggregate view of a completed scan:
- Page counts (completed, failed, challenged)
- LCP averages (avg, median, P95)
- Overall / document / static asset cache hit ratios
- CDN distribution across all pages

### Page table
Every scanned page in a sortable, filterable table. Filter by CDN provider, cache state, or search by URL. Sort by LCP, TTFB, size, request count, or cache hit ratio.

### Page rankings (per scan)
Top 10 best and worst pages for LCP, TTFB, or cache hit ratio — useful for quickly spotting outliers.

### Page detail
The full breakdown for a single page:
- Performance metrics: LCP, FCP, CLS, TBT, Speed Index, TTFB, performance score
- Resource breakdown by type (JS, CSS, images, fonts)
- Render-blocking resources
- CDN detection signals and confidence score
- Cache state timeline (every probe request with its cache state, age header, and latency)
- Warm outcome: what happened after the cache warming cycle
- Recommendations with evidence

### Global rankings
Cross-scan comparison. See which pages and scans perform best and worst for LCP, TTFB, or cache hit ratio — across your entire history. Cache hit ratio ranks by scan aggregate (not per-page).

---

## Cache states explained

| State | Meaning |
|---|---|
| `HIT` | Served from CDN cache |
| `MISS` | Served from origin |
| `BYPASS` | CDN is configured to skip cache for this URL |
| `EXPIRED` | Cached copy existed but was too old |
| `REVALIDATED` | Conditional request confirmed the cache was still fresh |
| `STALE` | Served stale via stale-while-revalidate |
| `DYNAMIC` | Response is explicitly non-cacheable |
| `CHALLENGE` | CDN presented a bot challenge (Cloudflare "Just a moment", etc.) |
| `UNKNOWN` | Couldn't determine cache state |

### Warm outcomes

| Outcome | Meaning |
|---|---|
| `warmed-hit` | Cache HIT was observed after warming |
| `remained-miss` | Stayed MISS after all warm attempts |
| `bypass` | CDN bypasses cache — warming has no effect |
| `uncacheable` | `Cache-Control: no-store` or `private` prevents caching |
| `challenged` | Bot challenge encountered during warming |
| `error-response` | Server returned 5xx during warming |

---

## Exports

From any scan dashboard you can export:
- **CSV** — all page metrics in spreadsheet format
- **JSON** — full data including cache events and recommendations

---

## Environment variables

Copy `.env.example` to `.env`. The defaults work for local use.

| Variable | Default | Description |
|---|---|---|
| `POSTGRES_PASSWORD` | `scannerpassword` | Database password |
| `VITE_API_URL` | *(empty)* | Override API URL for the frontend |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` |
| `SSRF_PROTECTION` | `true` | Block scans of private/internal IPs. Set `false` for isolated networks |
| `CORS_ORIGIN` | `*` | Allowed CORS origin |
| `MAX_SCAN_URLS` | `500` | Hard cap on URLs per scan |
| `WORKER_CONCURRENCY` | `3` | Parallel pages per worker process |
| `BROWSER_TIMEOUT_MS` | `30000` | Playwright page timeout |
| `PROBE_TIMEOUT_MS` | `15000` | HTTP probe timeout |
| `MAX_WARM_ATTEMPTS` | `5` | Max warm requests per page |
| `WARM_DELAY_MS` | `500` | Delay between warm requests |

---

## Local development (without Docker)

```bash
# Backend (terminal 1 — API server)
cd backend
npm install
npm run dev

# Backend (terminal 2 — scan worker)
cd backend
npm run dev:worker

# Frontend (terminal 3)
cd frontend
npm install
npm run dev
```

Requires Node.js 22+ and a running PostgreSQL + Redis instance (or just use `docker compose up postgres redis`).

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite, TanStack Query, Recharts, Tailwind CSS |
| Backend | Node.js 22, Express, TypeScript |
| Database | PostgreSQL 16 |
| Queue | BullMQ on Redis 7 |
| Browser automation | Playwright |
| Containers | Docker Compose |

---

## How the cache warming works

1. **Cold probe** — one HTTP GET, no prior requests, records cache state and headers
2. **Warm loop** — up to N follow-up requests (configurable), with a configurable delay between each; stops as soon as a `HIT` is observed or the CDN signals bypass/uncacheable
3. **Browser pass** — Playwright loads the page after warming so performance metrics reflect the cached experience
4. **Cache hit ratio** — calculated from the warm probes only (cold probe is excluded since it's always a MISS for uncached pages)

CDN detection happens automatically from response headers. Vendor-specific adapters handle Cloudflare, CloudFront, Fastly, and Akamai. Everything else falls back to generic heuristics (`Via`, `Age`, `X-Cache`).
