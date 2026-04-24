import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { scanApi, aiApi } from "../api/client";
import type { ScanMode, AiProvider, CreateScanRequest } from "../types";
import { ChevronDown, ChevronUp, Globe, List, Map, Search } from "lucide-react";
import clsx from "clsx";

type Tab = ScanMode;

const AKAMAI_PRAGMA_OPTIONS: { id: string; label: string; description: string }[] = [
  { id: "akamai-x-cache-on", label: "akamai-x-cache-on", description: "Returns X-Cache in response" },
  { id: "akamai-x-get-cache-key", label: "akamai-x-get-cache-key", description: "Returns X-Cache-Key" },
  { id: "akamai-x-get-true-cache-key", label: "akamai-x-get-true-cache-key", description: "Returns X-True-Cache-Key" },
  { id: "akamai-x-check-cacheable", label: "akamai-x-check-cacheable", description: "Returns X-Check-Cacheable" },
  { id: "akamai-x-get-request-id", label: "akamai-x-get-request-id", description: "Returns X-Akamai-Request-Id" },
];

function buildDebugHeaders(selectedPragmas: string[], fastlyDebug: boolean): Record<string, string> | undefined {
  const headers: Record<string, string> = {};
  if (selectedPragmas.length > 0) headers["pragma"] = selectedPragmas.join(", ");
  if (fastlyDebug) headers["fastly-debug"] = "1";
  return Object.keys(headers).length > 0 ? headers : undefined;
}

const TABS: { id: Tab; label: string; icon: typeof Globe; description: string }[] = [
  { id: "single", icon: Globe, label: "Single URL", description: "Scan one URL" },
  { id: "list", icon: List, label: "URL List", description: "Multiple URLs" },
  { id: "sitemap", icon: Map, label: "Sitemap", description: "From sitemap.xml" },
  { id: "crawl", icon: Search, label: "Crawl", description: "Crawl a domain" },
];

export default function NewScan() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Tab>("single");
  const [rootInput, setRootInput] = useState("");
  const [urlList, setUrlList] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedPragmas, setSelectedPragmas] = useState<string[]>([]);
  const [fastlyDebug, setFastlyDebug] = useState(false);
  const [settings, setSettings] = useState<{
    deviceProfile: "desktop" | "mobile" | "custom";
    maxPages: number;
    maxCrawlDepth: number;
    maxWarmAttempts: number;
    warmDelayMs: number;
    crawlDelay: number;
    concurrency: number;
    sameOriginOnly: boolean;
    respectRobotsTxt: boolean;
    normalizeQuerystrings: boolean;
    scanPerformance: boolean;
    scanCache: boolean;
    aiCacheAnalysis: boolean;
    aiProvider: AiProvider;
    aiModel: string;
    aiExtraPrompt: string;
    scanResources: boolean;
    enableBasicAuth: boolean;
    basicAuthUser: string;
    basicAuthPass: string;
    enableDebugHeaders: boolean;
    includePattern: string;
    excludePattern: string;
  }>({
    deviceProfile: "desktop",
    maxPages: 100,
    maxCrawlDepth: 3,
    maxWarmAttempts: 5,
    warmDelayMs: 500,
    crawlDelay: 0,
    concurrency: 3,
    sameOriginOnly: true,
    respectRobotsTxt: true,
    normalizeQuerystrings: false,
    scanPerformance: true,
    scanCache: true,
    aiCacheAnalysis: false,
    aiProvider: "custom" as AiProvider,
    aiModel: "",
    aiExtraPrompt: "",
    scanResources: false,
    enableBasicAuth: false,
    basicAuthUser: "",
    basicAuthPass: "",
    enableDebugHeaders: false,
    includePattern: "",
    excludePattern: "",
  });

  const createMutation = useMutation({
    mutationFn: (req: CreateScanRequest) => scanApi.create(req),
    onSuccess: (data) => {
      navigate(`/scans/${data.id}`);
    },
  });

  const { data: modelsData, isFetching: modelsFetching } = useQuery({
    queryKey: ["ai-models", settings.aiProvider],
    queryFn: () => aiApi.models(settings.aiProvider ?? "custom"),
    enabled: settings.aiCacheAnalysis,
    staleTime: 60_000,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input = rootInput.trim();
    if (!input) return;

    const urls =
      mode === "list"
        ? urlList.split("\n").map((u) => u.trim()).filter(Boolean)
        : undefined;

    createMutation.mutate({
      mode,
      rootInput: input,
      urls,
      settings: {
        ...settings,
        mode,
        perHostConcurrency: 2,
        requestTimeoutMs: 15000,
        browserTimeoutMs: 30000,
        maxRedirects: 10,
        crawlDelay: 0,
        includePattern: settings.includePattern || undefined,
        excludePattern: settings.excludePattern || undefined,
        aiProvider: settings.aiCacheAnalysis ? settings.aiProvider : undefined,
        aiModel: settings.aiCacheAnalysis ? (settings.aiModel || modelsData?.models[0]) : undefined,
        aiExtraPrompt: settings.aiCacheAnalysis && settings.aiExtraPrompt.trim() ? settings.aiExtraPrompt.trim() : undefined,
        basicAuth: (mode === "single" && settings.enableBasicAuth && settings.basicAuthUser)
          ? { username: settings.basicAuthUser, password: settings.basicAuthPass }
          : undefined,
        debugHeaders: (mode === "single" && settings.enableDebugHeaders)
          ? buildDebugHeaders(selectedPragmas, fastlyDebug)
          : undefined,
      },
    });
  };

  const placeholders: Record<Tab, string> = {
    single: "https://example.com/page",
    list: "https://example.com/ (add URLs in the list below)",
    sitemap: "https://example.com/sitemap.xml",
    crawl: "https://example.com",
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">New Scan</h1>
        <p className="text-sm text-gray-500 mt-1">
          Analyze performance and CDN cache behavior for any website
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Mode selector */}
        <div>
          <label className="label">Scan mode</label>
          <div className="grid grid-cols-4 gap-2">
            {TABS.map(({ id, icon: Icon, label, description }) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                className={clsx(
                  "flex flex-col items-center gap-1 p-3 rounded-lg border text-center transition-all",
                  mode === id
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{label}</span>
                <span className="text-[10px] text-current opacity-60">{description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* URL input */}
        <div>
          <label className="label">
            {mode === "single" && "URL"}
            {mode === "list" && "Root domain (for reference)"}
            {mode === "sitemap" && "Sitemap URL"}
            {mode === "crawl" && "Domain to crawl"}
          </label>
          <input
            type="url"
            value={rootInput}
            onChange={(e) => setRootInput(e.target.value)}
            placeholder={placeholders[mode]}
            required
            className="input"
          />
        </div>

        {/* URL list */}
        {mode === "list" && (
          <div>
            <label className="label">URLs (one per line)</label>
            <textarea
              value={urlList}
              onChange={(e) => setUrlList(e.target.value)}
              placeholder={"https://example.com/\nhttps://example.com/about\nhttps://example.com/blog"}
              rows={8}
              className="input font-mono text-xs resize-y"
            />
            <p className="text-xs text-gray-400 mt-1">
              {urlList.split("\n").filter((u) => u.trim()).length} URLs
            </p>
          </div>
        )}

        {/* Quick settings */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Device profile</label>
            <select
              value={settings.deviceProfile}
              onChange={(e) => setSettings((s) => ({ ...s, deviceProfile: e.target.value as "desktop" | "mobile" | "custom" }))}
              className="input"
            >
              <option value="desktop">Desktop (1280×800)</option>
              <option value="mobile">Mobile (390×844, throttled)</option>
            </select>
          </div>
          {mode !== "single" && (
            <div>
              <label className="label">Max pages</label>
              <input
                type="number"
                min={1}
                max={500}
                value={settings.maxPages}
                onChange={(e) => setSettings((s) => ({ ...s, maxPages: parseInt(e.target.value) || 100 }))}
                className="input"
              />
            </div>
          )}
        </div>

        {/* Scan type toggles */}
        <div className="space-y-3">
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.scanPerformance}
                onChange={(e) => setSettings((s) => ({ ...s, scanPerformance: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm text-gray-700">Performance metrics (browser)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.scanCache}
                onChange={(e) => setSettings((s) => ({ ...s, scanCache: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm text-gray-700">CDN cache analysis</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.aiCacheAnalysis}
                onChange={(e) => setSettings((s) => ({ ...s, aiCacheAnalysis: e.target.checked }))}
                className="rounded border-gray-300 text-purple-600"
              />
              <span className="text-sm text-gray-700">AI cache analysis</span>
            </label>
          </div>

          {settings.aiCacheAnalysis && (
            <div className="pl-1 space-y-2">
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600 whitespace-nowrap">Provider</label>
                <div className="flex gap-1">
                  {(["custom", "openai", "anthropic"] as AiProvider[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setSettings((s) => ({ ...s, aiProvider: p, aiModel: "" }))}
                      className={clsx(
                        "px-3 py-1 text-xs font-medium rounded-md border transition-colors",
                        settings.aiProvider === p
                          ? "bg-purple-600 text-white border-purple-600"
                          : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
                      )}
                    >
                      {p === "openai" ? "OpenAI" : p === "anthropic" ? "Anthropic" : "Custom"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600 whitespace-nowrap">Model</label>
                {modelsFetching ? (
                  <span className="text-xs text-gray-400">Loading models…</span>
                ) : (
                  <select
                    value={settings.aiModel || modelsData?.models[0] || ""}
                    onChange={(e) => setSettings((s) => ({ ...s, aiModel: e.target.value }))}
                    className="input py-1 text-sm w-auto"
                    disabled={!modelsData?.models.length}
                  >
                    {(modelsData?.models ?? []).map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                    {!modelsData?.models.length && (
                      <option value="">No models available</option>
                    )}
                  </select>
                )}
                {modelsData?.fallback && (
                  <span className="text-xs text-yellow-600">Provider unreachable — showing defaults</span>
                )}
              </div>
              <p className="text-xs text-gray-400">
                Uses AI to reason about cache headers and estimate hit ratio per page
              </p>
              <div>
                <label className="text-sm text-gray-600 block mb-1">
                  Extra prompt <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={settings.aiExtraPrompt}
                  onChange={(e) => setSettings((s) => ({ ...s, aiExtraPrompt: e.target.value }))}
                  placeholder="e.g. This site uses Akamai with surrogate keys. Focus on Surrogate-Control directives and flag any missing stale-while-revalidate settings."
                  rows={3}
                  maxLength={2000}
                  className="input text-sm resize-y"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Appended to each AI request as additional context. Max 2000 characters.
                </p>
              </div>
            </div>
          )}

          {mode === "single" && (
            <label className="flex items-center gap-2 cursor-pointer pl-0.5">
              <input
                type="checkbox"
                checked={settings.scanResources}
                onChange={(e) => setSettings((s) => ({ ...s, scanResources: e.target.checked }))}
                className="rounded border-gray-300 text-indigo-600"
              />
              <span className="text-sm text-gray-700">Resource cache report</span>
              <span className="text-xs text-gray-400">(sub-resources: scripts, images, fonts, …)</span>
            </label>
          )}

          {mode === "single" && (
            <div className="pl-0.5 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enableBasicAuth}
                  onChange={(e) => {
                    setSettings((s) => ({ ...s, enableBasicAuth: e.target.checked }));
                    if (!e.target.checked) setSettings((s) => ({ ...s, basicAuthUser: "", basicAuthPass: "" }));
                  }}
                  className="rounded border-gray-300 text-gray-600"
                />
                <span className="text-sm text-gray-700">Basic authentication</span>
                <span className="text-xs text-gray-400">(HTTP Basic Auth credentials)</span>
              </label>

              {settings.enableBasicAuth && (
                <div className="ml-6 p-3 rounded-lg border border-gray-200 bg-gray-50 space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Username</label>
                      <input
                        type="text"
                        value={settings.basicAuthUser}
                        onChange={(e) => setSettings((s) => ({ ...s, basicAuthUser: e.target.value }))}
                        placeholder="username"
                        autoComplete="off"
                        className="input text-sm py-1.5"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Password</label>
                      <input
                        type="password"
                        value={settings.basicAuthPass}
                        onChange={(e) => setSettings((s) => ({ ...s, basicAuthPass: e.target.value }))}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        className="input text-sm py-1.5"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">
                    Sent as an <code className="bg-gray-100 px-1 rounded">Authorization: Basic</code> header on every HTTP probe and browser request.
                  </p>
                </div>
              )}
            </div>
          )}

          {mode === "single" && (
            <div className="pl-0.5 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enableDebugHeaders}
                  onChange={(e) => {
                    setSettings((s) => ({ ...s, enableDebugHeaders: e.target.checked }));
                    if (!e.target.checked) { setSelectedPragmas([]); setFastlyDebug(false); }
                  }}
                  className="rounded border-gray-300 text-orange-500"
                />
                <span className="text-sm text-gray-700">Debug headers</span>
                <span className="text-xs text-gray-400">(inject request headers to surface CDN diagnostics)</span>
              </label>

              {settings.enableDebugHeaders && (
                <div className="ml-6 p-3 rounded-lg border border-orange-100 bg-orange-50/40 space-y-2">
                  <p className="text-xs font-medium text-orange-800 mb-2">
                    Akamai — Pragma debug directives
                    <span className="ml-1 font-normal text-orange-600">
                      (sent as <span className="font-mono">Pragma: …</span> request header)
                    </span>
                  </p>
                  {AKAMAI_PRAGMA_OPTIONS.map((opt) => (
                    <label key={opt.id} className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedPragmas.includes(opt.id)}
                        onChange={(e) => {
                          setSelectedPragmas((prev) =>
                            e.target.checked
                              ? [...prev, opt.id]
                              : prev.filter((id) => id !== opt.id)
                          );
                        }}
                        className="rounded border-orange-300 text-orange-500 mt-0.5"
                      />
                      <span className="flex-1">
                        <span className="text-xs font-mono text-gray-800">{opt.label}</span>
                        <span className="text-xs text-gray-400 ml-2">{opt.description}</span>
                      </span>
                    </label>
                  ))}
                  <p className="text-xs font-medium text-orange-800 mt-3 mb-2">
                    Fastly
                  </p>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fastlyDebug}
                      onChange={(e) => setFastlyDebug(e.target.checked)}
                      className="rounded border-orange-300 text-orange-500 mt-0.5"
                    />
                    <span className="flex-1">
                      <span className="text-xs font-mono text-gray-800">fastly-debug: 1</span>
                      <span className="text-xs text-gray-400 ml-2">Returns Fastly-Debug-TTL, Fastly-Debug-State, Fastly-Debug-Digest</span>
                    </span>
                  </label>

                  {(selectedPragmas.length > 0 || fastlyDebug) && (
                    <div className="text-xs font-mono text-orange-700 pt-2 mt-1 border-t border-orange-100 space-y-0.5">
                      {selectedPragmas.length > 0 && <p>pragma: {selectedPragmas.join(", ")}</p>}
                      {fastlyDebug && <p>fastly-debug: 1</p>}
                    </div>
                  )}
                  <p className="text-xs text-orange-600 pt-1">
                    Sent on all HTTP probes and Playwright browser requests.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Advanced settings */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            Advanced settings
            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showAdvanced && (
            <div className="p-4 space-y-4 bg-white">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Concurrency</label>
                  <input
                    type="number" min={1} max={10} value={settings.concurrency}
                    onChange={(e) => setSettings((s) => ({ ...s, concurrency: parseInt(e.target.value) || 3 }))}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Warm attempts</label>
                  <input
                    type="number" min={1} max={10} value={settings.maxWarmAttempts}
                    onChange={(e) => setSettings((s) => ({ ...s, maxWarmAttempts: parseInt(e.target.value) || 5 }))}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Warm delay (ms)</label>
                  <input
                    type="number" min={100} max={5000} step={100} value={settings.warmDelayMs}
                    onChange={(e) => setSettings((s) => ({ ...s, warmDelayMs: parseInt(e.target.value) || 500 }))}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Delay between requests (ms)</label>
                  <input
                    type="number" min={0} max={5000} step={100} value={settings.crawlDelay}
                    onChange={(e) => setSettings((s) => ({ ...s, crawlDelay: parseInt(e.target.value) || 0 }))}
                    className="input"
                    placeholder="0 (no delay)"
                  />
                  <p className="text-xs text-gray-400 mt-1">Pause between page scans to avoid rate limiting</p>
                </div>
                {(mode === "crawl" || mode === "sitemap") && (
                  <div>
                    <label className="label">Max crawl depth</label>
                    <input
                      type="number" min={0} max={10} value={settings.maxCrawlDepth}
                      onChange={(e) => setSettings((s) => ({ ...s, maxCrawlDepth: parseInt(e.target.value) || 3 }))}
                      className="input"
                    />
                  </div>
                )}
              </div>

              {mode === "crawl" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Include pattern (regex)</label>
                      <input
                        type="text" value={settings.includePattern}
                        onChange={(e) => setSettings((s) => ({ ...s, includePattern: e.target.value }))}
                        placeholder="/blog/.*"
                        className="input font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="label">Exclude pattern (regex)</label>
                      <input
                        type="text" value={settings.excludePattern}
                        onChange={(e) => setSettings((s) => ({ ...s, excludePattern: e.target.value }))}
                        placeholder="/admin/.*"
                        className="input font-mono text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox" checked={settings.sameOriginOnly}
                        onChange={(e) => setSettings((s) => ({ ...s, sameOriginOnly: e.target.checked }))}
                        className="rounded border-gray-300 text-blue-600"
                      />
                      <span className="text-sm text-gray-700">Same-origin only</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox" checked={settings.respectRobotsTxt}
                        onChange={(e) => setSettings((s) => ({ ...s, respectRobotsTxt: e.target.checked }))}
                        className="rounded border-gray-300 text-blue-600"
                      />
                      <span className="text-sm text-gray-700">Respect robots.txt</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox" checked={settings.normalizeQuerystrings}
                        onChange={(e) => setSettings((s) => ({ ...s, normalizeQuerystrings: e.target.checked }))}
                        className="rounded border-gray-300 text-blue-600"
                      />
                      <span className="text-sm text-gray-700">Normalize query strings</span>
                    </label>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Submit */}
        {createMutation.isError && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {createMutation.error instanceof Error
              ? createMutation.error.message
              : "Failed to create scan"}
          </div>
        )}

        <button
          type="submit"
          disabled={createMutation.isPending || !rootInput.trim()}
          className="btn-primary w-full justify-center py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {createMutation.isPending ? "Creating scan..." : "Start Scan"}
        </button>
      </form>
    </div>
  );
}
