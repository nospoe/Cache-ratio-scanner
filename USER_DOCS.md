# Site Scanner — User Documentation

## What is Site Scanner?

Site Scanner is a web application that measures the performance and CDN cache effectiveness of any website. It goes beyond header inspection by actually warming the CDN cache and measuring real browser performance after the cache is populated.

---

## Quick Start

### Prerequisites
- Docker and Docker Compose installed

### Start the application

```bash
# Copy environment file
cp .env.example .env

# Start all services (postgres, redis, api, worker, frontend)
docker-compose up

# Or run in the background
docker-compose up -d
```

Once running:
- **Frontend**: http://localhost:3000
- **API**: http://localhost:3001

---

## Creating a Scan

### Scan Modes

#### Single URL
Scan one specific page. Best for investigating a particular page in depth.

1. Select **Single URL**
2. Enter the full URL (e.g., `https://example.com/products`)
3. Choose device profile (Desktop or Mobile)
4. Click **Start Scan**

#### URL List
Provide a list of URLs to scan individually.

1. Select **URL List**
2. Enter a root domain (for reference)
3. Paste your URLs in the text area (one per line)
4. Click **Start Scan**

#### Sitemap
Automatically discover URLs from a sitemap.xml file.

1. Select **Sitemap**
2. Enter the sitemap URL (e.g., `https://example.com/sitemap.xml`)
3. Set **Max pages** to limit how many URLs are scanned
4. Click **Start Scan**

Supports sitemap index files (multiple nested sitemaps).

#### Crawl
Automatically discover pages by following links from a root domain.

1. Select **Crawl**
2. Enter the domain root (e.g., `https://example.com`)
3. Configure crawl settings:
   - **Max pages**: Maximum number of pages to scan (up to 500)
   - **Max crawl depth**: How many link-hops deep to go (0 = root only)
   - **Same-origin only**: Only follow links within the same domain
   - **Respect robots.txt**: Skip pages blocked by robots.txt
   - **Include/exclude pattern**: Regex to filter which URLs to scan
4. Click **Start Scan**

### Device Profiles

| Profile | Viewport | User Agent |
|---------|----------|------------|
| Desktop | 1280×800 | Default Chrome |
| Mobile | 390×844 | iPhone 17 Safari + network throttling |

### Advanced Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Concurrency | 3 | Parallel pages to scan simultaneously |
| Warm attempts | 5 | Max cache warming requests before measuring |
| Warm delay | 500ms | Delay between warm-up requests |
| Max crawl depth | 3 | Link depth for crawl mode |
| Normalize query strings | off | Sort query params for canonical URL dedup |

---

## Understanding Results

### Scan Dashboard

The summary dashboard shows aggregate metrics for all scanned pages:

- **Total pages / Completed / Failed / Challenged**: Count by outcome
- **Avg / Median / P95 LCP**: Largest Contentful Paint distribution
- **Avg TTFB**: Time to First Byte average
- **Overall Cache Hit Ratio**: Observed CDN hits / total eligible requests
- **Document cache hit ratio**: Cache effectiveness for HTML pages specifically
- **Static asset cache hit ratio**: Cache effectiveness for JS/CSS/images
- **CDN distribution**: Which CDNs were detected across all pages

### Page Rankings

The rankings table shows all scanned pages with sortable columns:

| Column | Description |
|--------|-------------|
| LCP | Largest Contentful Paint (browser measurement) |
| TTFB | Time to First Byte (cold HTTP probe) |
| Size | Total transfer size |
| Requests | Total number of HTTP requests |
| Cache Hit | Observed cache hit ratio for this page |
| Score | Simplified performance score (0–100) |

**Filtering**: Filter by CDN provider, cache state, or search URL.

### Page Detail

Click any page to see its full breakdown:

#### Performance
- **LCP** (≤2500ms good, ≤4000ms acceptable, >4000ms poor)
- **FCP** (≤1800ms good, ≤3000ms acceptable)
- **TBT** (≤200ms good, ≤600ms acceptable, >600ms poor)
- **CLS** (≤0.1 good, ≤0.25 acceptable)
- **TTFB**, Speed Index, total requests, bytes by resource type
- Render-blocking resources list

#### CDN Cache Analysis
- **Cold state**: Cache state on the first request
- **Warmed state**: Cache state after warm-up
- **Warm outcome**: Result of the warming phase (see below)
- **CDN signals**: The specific headers that identified the CDN
- **Cache event timeline**: Every request made (cold → warm → final) with cache state, age, and latency

#### Warm Outcomes

| Outcome | Meaning |
|---------|---------|
| `warmed-hit` | CDN cache HIT observed after warming |
| `remained-miss` | No HIT observed after max warm attempts |
| `bypass` | CDN is configured to bypass cache for this URL |
| `uncacheable` | Cache-Control headers prevent caching |
| `challenged` | Challenge or block page detected |
| `error-response` | Server error during warming |

#### Recommendations
Actionable findings categorized by severity:
- **Critical**: Issues causing measurable harm (e.g., error page cached, Vary:*)
- **Warning**: Issues reducing cache efficiency or performance
- **Info**: Optimization opportunities

#### Cache Hit Ratio
Calculated from observed CDN outcomes in the cache event timeline:

```
hit_ratio = HIT events / eligible events
```

Where **eligible** excludes: challenge pages, bypass responses, connection failures.

This is based on real observed cache behavior — not inferred from Cache-Control headers alone.

---

## CDN Detection

Site Scanner automatically identifies the CDN serving each page using response headers:

| CDN | Key Detection Signals |
|-----|----------------------|
| Cloudflare | `CF-Ray`, `CF-Cache-Status`, `cf-mitigated` |
| Amazon CloudFront | `x-amz-cf-id`, `x-amz-cf-pop`, `x-cache: Hit from cloudfront` |
| Fastly | `x-served-by`, `x-timer`, `x-cache` |
| Akamai | `x-akamai-request-id`, `x-cache: TCP_HIT`, `x-cache-key` |
| Unknown | Falls back to generic heuristics (Via, Age, X-Cache) with confidence score |

When the CDN is unknown, a **confidence score** is shown (0–49%). This means some caching behavior was detected but the CDN vendor could not be identified. Cache state inference is still attempted using standard HTTP headers.

---

## Challenge Page Detection

Site Scanner detects when a CDN or WAF is serving a challenge or block page instead of real content. Detection uses a scored heuristic:

| Signal | Weight |
|--------|--------|
| `cf-mitigated: challenge` header | +5 |
| Body contains "Just a moment" / "checking your browser" | +3 |
| HTTP 403 / 429 | +2 |
| Content-type mismatch (HTML when API expected) | +2 |
| Body contains "access denied" / "you have been blocked" | +2 |
| `Retry-After` header | +1 |
| Short HTML body (<5KB) | +1 |

Score ≥5 → **challenged**, Score 4 → **blocked**.

---

## Exports

From any completed scan dashboard:

- **CSV export**: All page metrics, cache states, performance scores in a spreadsheet-compatible format
- **JSON export**: Complete scan data including browser metrics, cache events, and recommendations

---

## API Reference

Base URL: `http://localhost:3001`

### Create a scan
```
POST /api/scans
Content-Type: application/json

{
  "mode": "single",          // single | list | sitemap | crawl
  "rootInput": "https://example.com",
  "urls": [],                // optional: pre-supplied URLs for list mode
  "settings": {
    "deviceProfile": "desktop",
    "maxPages": 100,
    "maxWarmAttempts": 5,
    "scanPerformance": true,
    "scanCache": true
  }
}

Response: { "id": "...", "status": "queued" }
```

### Get scan status
```
GET /api/scans/:id

Response: { ...scan, "aggregate": { ... }, "progress": { ... } }
```

### List pages
```
GET /api/scans/:id/pages?sortBy=lcp_ms&sortDir=desc&cdn=cloudflare&page=1&pageSize=50
```

### Page rankings
```
GET /api/scans/:id/pages/rankings?metric=lcp_ms&limit=10
```

### Get page detail
```
GET /api/scans/:id/pages/:pageId
```

### Exports
```
GET /api/scans/:id/export.csv
GET /api/scans/:id/export.json
```

### Cancel scan
```
DELETE /api/scans/:id
```

---

## Configuration

All configuration is via environment variables. Copy `.env.example` to `.env` and edit:

```env
# Database password
POSTGRES_PASSWORD=changeme

# Frontend → API URL (change if deploying to a server)
VITE_API_URL=http://localhost:3001

# Scan limits
MAX_SCAN_URLS=500
WORKER_REPLICAS=1
WORKER_CONCURRENCY=3

# Timeouts
BROWSER_TIMEOUT_MS=30000
PROBE_TIMEOUT_MS=15000

# Cache warming defaults
MAX_WARM_ATTEMPTS=5
WARM_DELAY_MS=500

# Security (disable only for isolated testing)
SSRF_PROTECTION=true
```

### Scaling workers

To run multiple workers in parallel:
```bash
WORKER_REPLICAS=2 docker-compose up --scale worker=2
```

---

## Security

- **SSRF protection**: All URLs are validated against private/reserved IP ranges before any request is made. Hostnames are DNS-resolved and checked. Disable only in trusted isolated environments with `SSRF_PROTECTION=false`.
- **Input validation**: All API inputs are validated with Zod schemas.
- **Audit log**: All scan creation, completion, and failure events are logged to the `audit_log` table.
- **No credentials stored**: Database password and other secrets are only used via environment variables.

---

## Troubleshooting

**Scan stuck in "queued" status**
- Check that the worker container started: `docker-compose logs worker`
- Check Redis is healthy: `docker-compose ps`

**Browser collection returning null metrics**
- Playwright Chromium must be installed in the worker container. The Dockerfile does this automatically.
- Check `docker-compose logs worker` for "Browser collection failed" messages.

**All pages show cache state UNKNOWN**
- The target site may not be behind a CDN, or CDN headers may not be exposed publicly.
- The fallback confidence score will be < 0.5 — check the CDN Signals section in page detail.

**Connection refused / SSRF errors**
- You're scanning a URL that resolves to a private IP. This is blocked by default. Ensure your target is a public URL.

**Performance metrics missing after scan completes**
- Check `scanPerformance: true` was set in scan settings.
- Check worker logs for timeout errors — increase `BROWSER_TIMEOUT_MS` for slow sites.
