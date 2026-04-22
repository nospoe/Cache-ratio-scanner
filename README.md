# Site Scanner and CDN performance analysis tool

  <img width="800" alt="Screenshot 2026-04-03 at 22 17 27"
  src="https://github.com/user-attachments/assets/7c5d37dd-c03a-4924-9694-e805f66eef47" />


> **Vibecoded** with Claude. Architected and designed by a senior system engineer with more than 10 years of experience working with CDNs. A web performance and CDN cache scanner that actually warms the cache before measuring it.

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
- **AI cache analysis** — optionally uses an LLM to reason about response headers and estimate the cache hit ratio independently of CDN-specific header patterns

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
| AI cache analysis | Off | Use an LLM to reason about headers and estimate cache hit ratio |
| AI provider | Custom | **Custom** (Ollama / any OpenAI-compatible server) or **OpenAI** (direct ChatGPT integration) |
| AI model | — | Fetched live from the selected provider; falls back to a default list if unreachable |
| Debug headers | Off | Inject CDN diagnostic request headers (Single URL only) — surfaces hidden cache metadata in response headers |

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
- **AI cache analysis summary** (when enabled): pages analysed, AI-judged cached count, average AI-estimated hit ratio, average confidence

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
- Response headers for cold and warm probes (tabbed view)
- Warm outcome: what happened after the cache warming cycle
- AI cache analysis (when enabled): LLM reasoning, estimated hit ratio, confidence score, and AI-inferred CDN provider
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

## AI Cache Analysis

AI cache analysis is an **optional, per-scan feature** that sends each page's response headers and real latency measurements to an LLM. The model reasons about cache state indicators and returns a structured verdict — independently of the built-in CDN adapter logic.

### Why it exists

The conventional cache analysis relies on vendor-specific header adapters (Cloudflare, CloudFront, Fastly, Akamai). If a site sits behind a custom proxy, an obscure CDN, or strips its cache headers, those adapters return `UNKNOWN`. The AI analyser reads the full header set and applies general HTTP caching knowledge, often surfacing useful signal even when no CDN fingerprint is present. It also incorporates real latency data: a significant TTFB/latency drop from cold to warmed probe is treated as a strong CDN edge-caching signal.

### Providers

Two providers are supported:

| Provider | How it connects | When to use |
|---|---|---|
| **Custom** | `AI_API_BASE_URL` + optional `OPENAI_API_KEY` | Self-hosted Ollama, LiteLLM, or any OpenAI-compatible server |
| **OpenAI** | `api.openai.com` + `OPENAI_API_KEY` | Direct ChatGPT — GPT-4o, GPT-4o mini, GPT-5, etc. |

Models are fetched live from the provider's `/models` endpoint at scan-creation time. If the provider is unreachable a fallback list is shown and you can still proceed.

### How it works

AI analysis runs as **Phase 6** of the scan pipeline, after all HTTP probes and cache warming are complete:

```
Cold probe → Warm loop → CDN detection → Cache normalisation → Browser metrics → Recommendations → AI analysis
```

For each page the worker sends to the model:
- Cold probe: HTTP status, headers, latency, TTFB
- Warmed probe: HTTP status, headers, latency, TTFB (if available)
- All warm events with request number, cache state, and latency

The model reasons about headers (`Cache-Control`, `CF-Cache-Status`, `X-Cache`, `Age`, `Vary`, `Via`, `Set-Cookie`, `Surrogate-Control`, Akamai-specific headers, etc.) alongside timing signals, then returns a structured JSON result.

### Output per page

| Field | Type | Description |
|---|---|---|
| `cached` | boolean | Whether the response was judged to be served from cache |
| `reasoning` | string | Step-by-step explanation referencing specific headers and latency |
| `cache_hit_ratio` | float 0–1 | Estimated proportion of requests that would be cache hits |
| `confidence` | float 0–1 | Model's self-assessed confidence in the verdict |
| `inferred_cdn` | string \| null | CDN provider identified from headers (e.g. `"Akamai"`, `"Cloudflare"`) |
| `model` | string | The model that produced this result |

Stored as `ai_cache_analysis` JSONB on the `page_results` table. Visible in the **Page Detail** view.

### Aggregate at scan level

When AI analysis was enabled the **Scan Dashboard** shows a summary card with:
- Pages successfully analysed vs. total scanned
- Count of pages the AI judged as cached
- Average AI-estimated cache hit ratio across all pages
- Average confidence (colour-coded: green ≥70%, yellow ≥40%, red <40%)

### Enabling AI analysis

1. Tick **AI cache analysis** in the New Scan form
2. Select **Custom** or **OpenAI** as the provider
3. Select a model from the dropdown (loaded live from the provider)
4. Set the relevant environment variables in `.env` (see below)

**Failures are non-fatal.** Network errors, HTTP errors, timeouts, and JSON parse failures are logged and skipped — the scan continues and the AI result for that page is simply absent. Set `LOG_LEVEL=debug` to see the full request payload and raw model response in worker logs.

---

## Debug Headers

Debug headers is an **optional, Single URL only** feature that injects diagnostic request headers into every probe — both HTTP requests and the Playwright browser pass. CDNs that support these headers echo back additional cache metadata in their responses, making it possible to see cache keys, TTLs, and cacheability verdicts that are normally invisible.

### Available presets

#### Akamai — Pragma directives

Akamai reads specific values from the `Pragma` request header and echoes diagnostic data back in the response. Multiple directives are comma-joined into a single `Pragma` header.

| Directive | Response header returned |
|---|---|
| `akamai-x-cache-on` | `X-Cache` — cache state (TCP_HIT, TCP_MISS, etc.) |
| `akamai-x-get-cache-key` | `X-Cache-Key` — the cache key used for this object |
| `akamai-x-get-true-cache-key` | `X-True-Cache-Key` — the cache key after Vary stripping |
| `akamai-x-check-cacheable` | `X-Check-Cacheable` — whether the object is cacheable (`yes`/`no`) |
| `akamai-x-get-request-id` | `X-Akamai-Request-Id` — unique request identifier for log correlation |

#### Fastly

| Header sent | Response headers returned |
|---|---|
| `Fastly-Debug: 1` | `Fastly-Debug-TTL`, `Fastly-Debug-State`, `Fastly-Debug-Digest` |

### How it works

When debug headers are enabled, the selected headers are sent on:
- The cold probe HTTP request
- Every warm-up HTTP request
- The Playwright browser navigation (injected via `page.setExtraHTTPHeaders()`, so they also apply to all sub-resource fetches)

The response headers returned by the CDN appear in the **Response Headers** card (cold and warm tabs) on the Page Detail view.

> **Note:** These headers only have effect if the target site is actually served by the respective CDN and the CDN is configured to honour debug pragma requests. They are harmless on other CDNs or origins.

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
| `AI_API_BASE_URL` | `https://chat.netcentric.biz/api` | Base URL for the **custom** provider (Ollama / OpenAI-compatible server). Ignored when using the OpenAI provider. |
| `OPENAI_API_KEY` | *(empty)* | API key for **both** providers. For OpenAI: authenticates against `api.openai.com`. For custom: sent as `Authorization: Bearer` — leave empty if not required. |

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
