import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { scanApi } from "../api/client";
import type { ScanMode, AiModel, CreateScanRequest } from "../types";
import { ChevronDown, ChevronUp, Globe, List, Map, Search } from "lucide-react";
import clsx from "clsx";

type Tab = ScanMode;

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
    aiModel: AiModel;
    scanResources: boolean;
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
    aiModel: "gemma3:27b",
    scanResources: false,
    includePattern: "",
    excludePattern: "",
  });

  const createMutation = useMutation({
    mutationFn: (req: CreateScanRequest) => scanApi.create(req),
    onSuccess: (data) => {
      navigate(`/scans/${data.id}`);
    },
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
        aiModel: settings.aiCacheAnalysis ? settings.aiModel : undefined,
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
            <div className="flex items-center gap-3 pl-1">
              <label className="text-sm text-gray-600 whitespace-nowrap">AI model</label>
              <select
                value={settings.aiModel}
                onChange={(e) => setSettings((s) => ({ ...s, aiModel: e.target.value as AiModel }))}
                className="input py-1 text-sm w-auto"
              >
                <option value="gemma3:27b">gemma3:27b</option>
                <option value="gemma4:31b">gemma4:31b</option>
                <option value="gpt-oss:latest">gpt-oss:latest</option>
              </select>
              <p className="text-xs text-gray-400">
                Uses AI to reason about cache headers and estimate hit ratio per page
              </p>
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
