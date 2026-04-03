Product requirements: Website Performance + CDN Cache Scanner

1. Goal

Build a Dockerized web application that scans either:
	1.	a single URL, or
	2.	a list/sitemap/crawl-discovered set of URLs

and reports:
	•	page performance for each scanned page
	•	ranking of fastest and slowest pages
	•	CDN caching effectiveness
	•	cache ratio derived from real cache outcomes
	•	warmed-cache measurements
	•	likely DDoS/challenge/error-page behavior on non-cacheable responses
	•	a clean, smooth frontend with a consistent UX

The system must work with the most common CDNs by relying on standard HTTP behavior plus CDN-specific response headers where available.

2. Primary use cases

Single-page scan

A user enters one URL and gets:
	•	full performance breakdown
	•	cold vs warmed cache comparison
	•	caching headers and cacheability diagnosis
	•	CDN detection
	•	cache hit/miss evidence
	•	flags for challenge pages, blocked pages, or non-cacheable error responses

Multi-page scan

A user enters:
	•	a domain root
	•	a sitemap URL
	•	a list of URLs
	•	or enables crawler mode

and gets:
	•	per-page metrics
	•	top fastest pages
	•	top slowest pages
	•	cacheability summary
	•	cache-hit ratio summary
	•	grouped issues by template/path pattern
	•	exportable results

3. High-level product requirements

The application must include a frontend and backend, each running in Docker, orchestrated with Docker Compose.

The application must feel like a production SaaS tool:
	•	responsive UI
	•	consistent spacing, colors, typography, tables, filters, and charts
	•	clear loading states
	•	scan progress visibility
	•	no jarring page refreshes
	•	stable behavior during long scans

4. Measurement philosophy

The scanner must separate three different concerns:
	1.	Browser/page performance
Use real browser automation for rendering and page timing.
	2.	HTTP/CDN cache behavior
Use direct HTTP probing to inspect cache headers, response headers, response codes, Age, and CDN-specific cache-status indicators.
	3.	Availability/security behavior on non-cacheable responses
Detect whether error pages, challenge pages, or blocked responses are being served and whether they are cached or bypassed.

For browser performance, the baseline measurement set should align with Lighthouse/Chrome-style metrics such as FCP, LCP, CLS, TBT, and Speed Index. Lighthouse weights LCP, TBT, and CLS heavily, and Chrome recommends newer metrics like LCP/TBT/INP over the older TTI approach.  ￼

For caching behavior, the scanner must inspect HTTP cache semantics such as Cache-Control, s-maxage, stale-while-revalidate, and Age, because these directly affect whether shared caches and CDNs can reuse responses.  ￼

5. Supported CDN approach

The app must support “most popular CDNs” through an adapter system with at least these first-class adapters:
	•	Cloudflare
	•	Fastly
	•	Amazon CloudFront
	•	Akamai

Rationale:
	•	Cloudflare exposes CF-Cache-Status and uses standard cache semantics.  ￼
	•	Fastly exposes X-Cache and related delivery headers.  ￼
	•	CloudFront distinguishes hit/miss at the edge and documents cache statistics and response behavior.  ￼
	•	Akamai can expose cache status via configured response headers and pragma-assisted diagnostics.  ￼

The design must allow adding future adapters without changing the scan engine.

6. Functional requirements

6.1 Input modes

Support all of the following:
	•	Single URL input
	•	Manual list of URLs input
	•	Sitemap URL input
	•	Domain crawl input
	•	CSV upload of URLs

For crawling mode, support:
	•	max pages limit
	•	max crawl depth
	•	same-origin restriction
	•	include/exclude regex rules
	•	canonical URL normalization
	•	duplicate URL suppression
	•	querystring normalization options
	•	robots.txt aware mode toggle
	•	authenticated/private scan mode disabled by default

6.2 Scan modes

Each scan must support:
	•	Performance-only
	•	Cache-only
	•	Full scan
	•	Crawl scan

Each scan must also support device/network presets:
	•	Desktop default
	•	Mobile throttled
	•	Custom network/CPU profile

6.3 Performance measurement requirements

For each page, collect at minimum:
	•	final URL
	•	redirect count and redirect chain
	•	response status code
	•	TTFB
	•	DNS/connect/TLS timing where possible
	•	FCP
	•	LCP
	•	CLS
	•	TBT
	•	Speed Index
	•	fully loaded / network idle approximation
	•	total transfer size
	•	total requests
	•	JavaScript bytes
	•	CSS bytes
	•	image bytes
	•	font bytes
	•	third-party request count
	•	main-thread long-task summary
	•	render-blocking resource summary

The system must produce both:
	•	raw metrics
	•	normalized score per page

The system must keep browser measurements and HTTP measurements separate in the data model.

6.4 Cache warming requirement

Cache must be warmed before measurement.

Required process for every page:

Step A: Cold probe

Perform an initial direct HTTP probe and record:
	•	status code
	•	headers
	•	cache headers
	•	CDN headers
	•	Age
	•	cache status
	•	latency

Step B: Warm phase

Issue repeated warm-up requests until one of these is true:
	•	a CDN hit is observed
	•	Age increases on subsequent requests
	•	max warm attempts reached
	•	the URL is classified as uncacheable/challenged/blocked

Step C: Warm measurement

After the warm phase:
	•	run warmed HTTP probes
	•	run warmed browser-based performance measurement
	•	store warmed vs cold comparison

This requirement exists because Age indicates how long an object has lived in a proxy cache, and CDN-specific hit/miss headers reveal whether an object has actually reached cache.  ￼

Warming rules
	•	Default max warm attempts: 5
	•	Default delay between attempts: configurable, 250–1000 ms
	•	Per-page warming outcome:
	•	warmed-hit
	•	remained-miss
	•	bypass
	•	uncacheable
	•	challenged
	•	error-response
	•	Warming must use the same request profile as the final measurement unless overridden

6.5 Cache ratio calculation

The app must calculate cache ratio from observed CDN cache outcomes, not from guessed cacheability alone.

For each page:
	•	cache_hit_ratio = hit_responses / eligible_measurement_responses

Where:
	•	hit_responses are responses classified as CDN hits
	•	eligible_measurement_responses exclude:
	•	challenge pages
	•	blocked responses
	•	explicit bypass responses
	•	connection failures
	•	unsupported/unknown adapter responses if cache state cannot be inferred

Also calculate:
	•	cold hit ratio
	•	warmed hit ratio
	•	origin ratio
	•	bypass ratio
	•	error-page cache ratio
	•	non-200 cache ratio
	•	static asset cache ratio
	•	HTML document cache ratio

The UI must clearly distinguish:
	•	cacheability: whether a page appears cacheable by headers/config
	•	actual cache outcome: whether the CDN served a hit
	•	effective cache ratio: observed hits over eligible requests

6.6 CDN detection and normalization

The backend must implement a normalization layer:

Unified cache states

Normalize CDN-specific outputs into:
	•	HIT
	•	MISS
	•	BYPASS
	•	EXPIRED
	•	REVALIDATED
	•	STALE
	•	DYNAMIC
	•	ERROR
	•	CHALLENGE
	•	UNKNOWN

CDN-specific examples
	•	Cloudflare: use CF-Cache-Status and Age. Cloudflare documents statuses through CF-Cache-Status.  ￼
	•	Fastly: use X-Cache, optionally X-Served-By. Fastly documents X-Cache as hit/miss.  ￼
	•	CloudFront: use hit/miss semantics from CloudFront cache statistics or available response metadata.  ￼
	•	Akamai: use configured cache-status response headers and pragma-assisted diagnostics where enabled.  ￼

If CDN is unknown:
	•	fall back to standard HTTP inference from Age, Cache-Control, Via, Server, X-Cache, and latency patterns
	•	mark confidence score

6.7 Error pages and DDoS/challenge detection

The system must explicitly test and report non-cacheing pages, especially:
	•	404 pages
	•	403 pages
	•	429 pages
	•	500/502/503 pages
	•	custom error pages
	•	challenge or block pages

Required checks

For each page set, where feasible:
	•	detect if 404 pages are cacheable or cached
	•	detect if blocked/challenge pages are returned
	•	detect if challenge pages are HTML even when API/resource type expected
	•	detect if error pages are bypassed vs cached
	•	detect if custom error pages are being served from the CDN

Cloudflare challenge pages can be detected using the cf-mitigated: challenge header, and challenge responses use text/html regardless of requested resource type.  ￼

CloudFront documents custom error-page behavior and multiple error response classes including 403 and 503.  ￼

Detection output

Classify suspicious cases as:
	•	likely bot/challenge page
	•	likely WAF/DDoS block
	•	likely origin error page
	•	likely custom CDN error page
	•	likely uncached dynamic page
	•	likely intentionally bypassed response

Required heuristics

Use a confidence model based on:
	•	status code
	•	content-type mismatch
	•	body/title patterns
	•	presence of CDN security headers
	•	repeated request consistency
	•	cache headers
	•	cache-status headers
	•	unusually short HTML challenge payloads
	•	Retry-After on rate limits

6.8 Fastest and slowest page ranking

For crawl/multi-page scans, generate:
	•	top 10 fastest pages
	•	top 10 slowest pages
	•	sortable ranking table for all pages

Ranking must support:
	•	by LCP
	•	by TTFB
	•	by total load time
	•	by total bytes
	•	by request count
	•	by cache hit ratio
	•	by warmed-vs-cold delta

Also provide:
	•	worst-regression pages after warmup
	•	most improved pages after warmup
	•	slowest uncached pages
	•	fastest cached pages

6.9 Detailed per-page breakdown

Every page detail view must include:

Overview
	•	URL
	•	final URL
	•	status code
	•	content-type
	•	detected CDN
	•	cache state
	•	warm state
	•	overall score

Performance
	•	core metrics
	•	waterfall summary
	•	resource-type distribution
	•	third-party contribution
	•	render-blocking summary

Caching
	•	response headers
	•	cache-control interpretation
	•	cacheability assessment
	•	actual hit/miss sequence
	•	Age observations
	•	TTL interpretation
	•	whether shared-cache directives exist
	•	probable reasons for miss/bypass

Security/error behavior
	•	challenge/block detection
	•	error-page behavior
	•	custom error-page evidence
	•	whether non-200 responses appear cached

Recommendations

Actionable findings such as:
	•	HTML not cached despite public, s-maxage
	•	query strings fragment cache key
	•	too many forwarded headers/cookies reduce cache efficiency
	•	error pages unexpectedly cached
	•	CDN hit achieved only after multiple warms
	•	performance dominated by render-blocking JS
	•	origin latency driving LCP/TTFB

CloudFront explicitly notes that forwarding unnecessary headers reduces cache hit ratio.  ￼

7. Reporting requirements

7.1 Dashboard summary

The summary dashboard must show:
	•	total pages scanned
	•	pages successfully measured
	•	pages with errors
	•	detected CDNs distribution
	•	average LCP
	•	median LCP
	•	95th percentile LCP
	•	average TTFB
	•	overall warmed cache hit ratio
	•	document cache hit ratio
	•	static asset cache hit ratio
	•	count of challenged/blocked pages
	•	count of cache-bypass pages
	•	count of non-cacheable HTML pages

7.2 Exports

Support export as:
	•	CSV
	•	JSON
	•	PDF report optional, not required for v1

7.3 Historical comparison

Preferred for v1.1, optional for v1:
	•	compare two scans
	•	highlight regressions/improvements
	•	track cache ratio drift over time

8. Architecture requirements

8.1 Backend

Use a backend that supports:
	•	job queue
	•	concurrent workers
	•	browser automation
	•	HTTP probing
	•	structured storage
	•	REST or GraphQL API

Recommended stack:
	•	Node.js or Python backend
	•	Playwright for browser-based performance collection
	•	lightweight HTTP client for probe/warm/caching checks
	•	PostgreSQL for persistence
	•	Redis for job queue and scan state

8.2 Frontend

Use a modern frontend framework:
	•	React/Next.js or similar

Required UI capabilities:
	•	create scan
	•	monitor scan progress
	•	view scan summary
	•	view rankings
	•	filter/sort pages
	•	inspect single page detail
	•	export results

8.3 Containers

Provide:
	•	frontend container
	•	backend container
	•	worker container
	•	postgres container
	•	redis container
	•	optional nginx reverse proxy container

Must include:
	•	Dockerfiles for frontend and backend
	•	docker-compose.yml
	•	environment variable documentation
	•	one-command local startup

9. API requirements

Minimum endpoints:
	•	POST /scans create scan
	•	GET /scans/:id scan status and summary
	•	GET /scans/:id/pages paginated page list
	•	GET /scans/:id/pages/:pageId detailed page result
	•	GET /scans/:id/export.csv
	•	GET /scans/:id/export.json

Scan creation payload must support:
	•	mode
	•	URLs
	•	sitemap URL
	•	crawl settings
	•	device profile
	•	concurrency
	•	max pages
	•	warm attempts
	•	timeout settings
	•	headers/user-agent override
	•	basic auth optional
	•	respect robots toggle

10. Data model requirements

Core entities:

Scan
	•	id
	•	created_at
	•	status
	•	mode
	•	root input
	•	settings
	•	aggregate metrics

PageResult
	•	page id
	•	scan id
	•	original URL
	•	final URL
	•	status
	•	detected CDN
	•	cache adapter
	•	content-type
	•	cold metrics
	•	warmed metrics
	•	cache events
	•	error/challenge flags
	•	recommendations
	•	timestamps

CacheEvent
	•	request number
	•	phase: cold/warm/final
	•	status code
	•	cache state normalized
	•	raw cache headers
	•	Age
	•	latency
	•	eligibility flag

11. UX requirements

The UI must be smooth and consistent.

That means:
	•	consistent layout grid
	•	no style drift across pages
	•	unified card/table/chart language
	•	searchable and filterable tables
	•	persistent scan progress state
	•	skeleton loaders
	•	clear empty states
	•	clear failure states
	•	sticky filters for long result tables
	•	responsive design for laptop screens first
	•	no modal overload
	•	fast page transitions

Required screens:
	•	new scan form
	•	scan list/history
	•	live scan progress
	•	summary dashboard
	•	page rankings
	•	page details
	•	settings/help

12. Performance and scalability requirements

Backend must support:
	•	at least 500 URLs per scan in standard mode
	•	concurrency controls
	•	rate limiting per host
	•	retry with backoff for transient failures
	•	timeout handling
	•	cancellation of running scans

Must avoid:
	•	overloading a target site
	•	uncontrolled crawl expansion
	•	noisy parallel warm-up storms

Required controls:
	•	global concurrency
	•	per-host concurrency
	•	crawl delay
	•	request timeout
	•	max redirects
	•	max asset capture size

13. Security and compliance requirements
	•	No credential storage in plain text
	•	Secrets via environment variables
	•	SSRF protections on backend fetching
	•	URL allow/deny validation
	•	private IP / localhost scan restrictions by default
	•	audit log for scan creation and completion
	•	sanitize all rendered HTML snippets
	•	strict input validation

14. Observability requirements

Must include:
	•	structured logs
	•	scan/job logs
	•	error reporting
	•	worker health checks
	•	container health checks
	•	metrics for queue size, scan duration, page success rate

15. Acceptance criteria

The product is acceptable only if all of the following are true:
	1.	A user can run a single-page scan and get both performance metrics and CDN cache diagnostics.
	2.	A user can run a multi-page crawl/list scan and receive ranked fastest and slowest pages.
	3.	Cache warming occurs before final measurement and the warmed outcome is visible.
	4.	Cache ratio is based on observed cache hits/misses, not only header guesses.
	5.	The app can normalize cache evidence for Cloudflare, Fastly, CloudFront, and Akamai.
	6.	The app can flag likely challenge pages, blocked pages, and error-page caching behavior.
	7.	Frontend and backend run fully through Docker Compose.
	8.	The interface is visually consistent and supports filtering, sorting, and drilling into details.
	9.	Results are exportable as CSV and JSON.
	10.	Unknown CDN cases degrade gracefully with an explicit confidence indicator.

16. Recommended implementation notes for the coding agent

Use a plugin-based analyzer design:
	•	crawler
	•	browser performance collector
	•	http probe collector
	•	cdn detector
	•	cache normalizer
	•	challenge/error detector
	•	recommendation engine
	•	report aggregator

Do not couple CDN logic to UI code.
Do not infer cache hits from performance alone.
Do not treat “cacheable by headers” as equivalent to “served from cache.”
Store both raw evidence and normalized interpretation.

17. Nice-to-have items after v1
	•	authenticated scans
	•	recurring scheduled scans
	•	Lighthouse trace download
	•	HAR export
	•	Slack/webhook alerts
	•	visual diff between two scans
	•	path grouping by template
	•	origin-vs-edge latency attribution
	•	INP support when available in the measurement flow
