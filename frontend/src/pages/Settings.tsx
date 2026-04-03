import { Card } from "../components/ui/Card";
import { ExternalLink } from "lucide-react";

export default function Settings() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Settings & Help</h1>
        <p className="text-sm text-gray-500 mt-0.5">About Site Scanner v1.0</p>
      </div>

      <Card>
        <h2 className="font-semibold text-gray-900 mb-3">About</h2>
        <p className="text-sm text-gray-600">
          Site Scanner analyzes website performance and CDN cache effectiveness.
          It supports Cloudflare, Amazon CloudFront, Fastly, and Akamai with
          automatic detection and normalized cache state reporting.
        </p>
      </Card>

      <Card>
        <h2 className="font-semibold text-gray-900 mb-3">Scan Modes</h2>
        <div className="space-y-3 text-sm">
          <div>
            <p className="font-medium text-gray-800">Single URL</p>
            <p className="text-gray-500">Scan one page with full performance + cache analysis</p>
          </div>
          <div>
            <p className="font-medium text-gray-800">URL List</p>
            <p className="text-gray-500">Provide multiple URLs, one per line</p>
          </div>
          <div>
            <p className="font-medium text-gray-800">Sitemap</p>
            <p className="text-gray-500">Provide a sitemap.xml URL — supports sitemap indexes</p>
          </div>
          <div>
            <p className="font-medium text-gray-800">Crawl</p>
            <p className="text-gray-500">
              Automatically discover pages by following links, with depth/regex/robots.txt controls
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold text-gray-900 mb-3">Cache Warming</h2>
        <p className="text-sm text-gray-600 mb-2">
          For every scanned page, Site Scanner performs three phases:
        </p>
        <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
          <li>Cold probe — initial request, captures headers and cache state</li>
          <li>Warm phase — repeated requests until a CDN HIT is observed or max attempts reached</li>
          <li>Warmed measurement — browser performance is measured after the cache is warm</li>
        </ol>
        <p className="text-xs text-gray-400 mt-2">
          This ensures performance metrics reflect cached-page speed, not origin cold-start latency.
        </p>
      </Card>

      <Card>
        <h2 className="font-semibold text-gray-900 mb-3">CDN Detection</h2>
        <div className="space-y-2 text-sm text-gray-600">
          <p>Detection uses CDN-specific response headers:</p>
          <ul className="space-y-1 text-xs font-mono">
            <li>Cloudflare — CF-Ray, CF-Cache-Status, cf-mitigated</li>
            <li>CloudFront — x-amz-cf-id, x-amz-cf-pop, x-cache: Hit from cloudfront</li>
            <li>Fastly — x-served-by, x-timer, x-cache</li>
            <li>Akamai — x-akamai-request-id, x-cache (TCP_HIT patterns), x-cache-key</li>
          </ul>
          <p className="text-xs text-gray-400">
            Unknown CDNs fall back to generic inference with a confidence score shown in the UI.
          </p>
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold text-gray-900 mb-3">Exports</h2>
        <p className="text-sm text-gray-600">
          Completed scans can be exported as CSV or JSON from the scan dashboard.
          CSV includes all page metrics, cache states, and performance scores.
          JSON includes the full raw data including browser metrics and cache events.
        </p>
      </Card>
    </div>
  );
}
