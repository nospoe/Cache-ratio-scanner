import clsx from "clsx";
import type { AiCacheAnalysisResult, NormalizedCacheState, CdnProvider, RecommendationSeverity } from "../../types";

interface BadgeProps {
  label: string;
  variant?: "default" | "success" | "warning" | "danger" | "info" | "neutral";
  size?: "sm" | "md";
  className?: string;
}

export function Badge({ label, variant = "default", size = "sm", className }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center font-medium rounded-full",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
        {
          "bg-gray-100 text-gray-700": variant === "default" || variant === "neutral",
          "bg-green-100 text-green-700": variant === "success",
          "bg-yellow-100 text-yellow-700": variant === "warning",
          "bg-red-100 text-red-700": variant === "danger",
          "bg-blue-100 text-blue-700": variant === "info",
        },
        className
      )}
    >
      {label}
    </span>
  );
}

const CACHE_STATE_VARIANTS: Record<NormalizedCacheState, BadgeProps["variant"]> = {
  HIT: "success",
  MISS: "neutral",
  BYPASS: "warning",
  EXPIRED: "warning",
  REVALIDATED: "info",
  STALE: "warning",
  DYNAMIC: "neutral",
  ERROR: "danger",
  CHALLENGE: "danger",
  UNKNOWN: "neutral",
};

export function CacheStateBadge({ state }: { state: NormalizedCacheState | null }) {
  if (!state) return <Badge label="N/A" variant="neutral" />;
  return <Badge label={state} variant={CACHE_STATE_VARIANTS[state]} />;
}

/**
 * Like CacheStateBadge but correlates UNKNOWN with the AI analysis result when available.
 * When cache_state is UNKNOWN and AI has a verdict, shows the AI-inferred state with a
 * small purple "AI" tag so the source is always transparent.
 */
export function EffectiveCacheStateBadge({
  state,
  aiAnalysis,
}: {
  state: NormalizedCacheState | null;
  aiAnalysis?: AiCacheAnalysisResult | null;
}) {
  if (state !== "UNKNOWN" || !aiAnalysis) {
    return <CacheStateBadge state={state} />;
  }

  const inferred: NormalizedCacheState = aiAnalysis.cached ? "HIT" : "MISS";

  return (
    <span className="inline-flex items-center gap-1">
      <Badge label={inferred} variant={CACHE_STATE_VARIANTS[inferred]} />
      <span
        className="text-[9px] font-semibold px-1 py-0.5 rounded bg-purple-100 text-purple-600 leading-none"
        title={`AI-inferred from: ${aiAnalysis.reasoning}`}
      >
        AI
      </span>
    </span>
  );
}

const CDN_COLORS: Record<CdnProvider, string> = {
  cloudflare: "bg-orange-100 text-orange-700",
  cloudfront: "bg-yellow-100 text-yellow-700",
  fastly: "bg-purple-100 text-purple-700",
  akamai: "bg-blue-100 text-blue-700",
  unknown: "bg-gray-100 text-gray-600",
};

export function CdnBadge({ provider, confidence }: { provider: CdnProvider | null; confidence?: string | null }) {
  if (!provider) return <Badge label="Unknown" variant="neutral" />;
  const label = provider === "cloudfront" ? "CloudFront" :
    provider.charAt(0).toUpperCase() + provider.slice(1);
  return (
    <span className={clsx("inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full", CDN_COLORS[provider])}>
      {label}
      {confidence && confidence !== "high" && (
        <span className="opacity-60 text-[10px]">({confidence})</span>
      )}
    </span>
  );
}

const SEVERITY_VARIANTS: Record<RecommendationSeverity, BadgeProps["variant"]> = {
  critical: "danger",
  warning: "warning",
  info: "info",
};

export function SeverityBadge({ severity }: { severity: RecommendationSeverity }) {
  return <Badge label={severity} variant={SEVERITY_VARIANTS[severity]} />;
}

export function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, BadgeProps["variant"]> = {
    queued: "neutral",
    running: "info",
    completed: "success",
    failed: "danger",
    cancelled: "neutral",
    pending: "neutral",
  };
  return <Badge label={status} variant={variants[status] ?? "neutral"} />;
}
