import type { ChallengeDetectorOutput, PageWorkingState } from "../../types";
import { runHeuristics } from "./heuristics";
import { getAdapterForProvider } from "../cdnDetector";

export function detectChallenge(state: PageWorkingState): ChallengeDetectorOutput {
  const probe = state.warmedProbe ?? state.coldProbe;
  if (!probe) {
    return {
      is_challenged: false,
      is_blocked: false,
      challenge_type: null,
      confidence: 0,
      signals: [],
    };
  }

  const provider = state.cdnDetector?.provider;
  const adapter = provider ? getAdapterForProvider(provider) : null;

  // CDN adapter challenge check (takes precedence)
  if (adapter?.isChallengeResponse(probe.response_headers)) {
    const signals = adapter.extractSignals(probe.response_headers);
    return {
      is_challenged: true,
      is_blocked: false,
      challenge_type: "bot-challenge",
      confidence: 0.95,
      signals: ["CDN adapter flagged challenge response", ...signals],
    };
  }

  const result = runHeuristics(
    probe.status_code,
    probe.response_headers,
    probe.content_type,
    undefined, // body not available at this phase
    undefined
  );

  return {
    is_challenged: result.is_challenged,
    is_blocked: result.is_blocked,
    challenge_type: result.challenge_type,
    confidence: result.confidence,
    signals: result.signals,
  };
}

export function runChallengeDetection(state: PageWorkingState): PageWorkingState {
  const output = detectChallenge(state);
  return { ...state, challengeDetector: output };
}
