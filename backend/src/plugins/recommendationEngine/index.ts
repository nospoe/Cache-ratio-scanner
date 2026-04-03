import type { PageWorkingState, Recommendation } from "../../types";
import { getCacheRecommendations } from "./rules/cacheRules";
import { getPerformanceRecommendations } from "./rules/performanceRules";
import { getCdnRecommendations } from "./rules/cdnRules";

export function generateRecommendations(state: PageWorkingState): PageWorkingState {
  const recs: Recommendation[] = [
    ...getCacheRecommendations(state),
    ...getPerformanceRecommendations(state),
    ...getCdnRecommendations(state),
  ];

  // Deduplicate by id
  const seen = new Set<string>();
  const unique = recs.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });

  // Sort: critical > warning > info
  const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  unique.sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3));

  return { ...state, recommendations: unique };
}
