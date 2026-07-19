import type {
  InterventionDecision,
  Observation,
  ObservationKind,
} from "../domain/types.js";

const BASE_SCORES: Record<ObservationKind, number> = {
  manual: 1,
  repeated_error: 0.95,
  meeting_question: 0.95,
  social_draft: 0.9,
  stuck: 0.82,
  test_failed: 0.78,
  build_failed: 0.78,
  commit: 0.58,
  test_passed: 0.45,
  build_passed: 0.45,
  window_changed: 0.08,
};

export function evaluateObservation(
  observation: Observation,
  threshold: number,
): InterventionDecision {
  if (observation.sensitivity === "restricted") {
    return {
      shouldIntervene: false,
      score: 0,
      reason: "Restricted observations are never sent to Codex.",
    };
  }

  const score = BASE_SCORES[observation.kind];
  return {
    shouldIntervene: score >= threshold,
    score,
    reason:
      score >= threshold
        ? `Event score ${score.toFixed(2)} meets threshold ${threshold.toFixed(2)}.`
        : `Event score ${score.toFixed(2)} is below threshold ${threshold.toFixed(2)}.`,
  };
}
