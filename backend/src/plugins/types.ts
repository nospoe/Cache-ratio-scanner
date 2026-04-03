// Re-export all plugin-related types from the central types module
export type {
  PluginContext,
  PageWorkingState,
  CdnProvider,
  CdnConfidence,
  NormalizedCacheState,
  WarmOutcome,
  ChallengeType,
  ProbeRecord,
  CacheEvent,
  CdnDetectorOutput,
  CacheNormalizerOutput,
  BrowserMetrics,
  WaterfallEntry,
  ChallengeDetectorOutput,
  Recommendation,
  RecommendationSeverity,
} from "../types";

// CdnAdapter interface — one per CDN provider
export interface CdnAdapter {
  readonly name: import("../types").CdnProvider;
  detect(headers: Record<string, string>): boolean;
  normalizeCacheState(headers: Record<string, string>): import("../types").NormalizedCacheState;
  extractSignals(headers: Record<string, string>): string[];
  isChallengeResponse(headers: Record<string, string>, body?: string): boolean;
  getConfidenceScore(headers: Record<string, string>): number;
}
