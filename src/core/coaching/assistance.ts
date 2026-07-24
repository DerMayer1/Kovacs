import type { AssistanceLevel, ManualRequest, Profile, ProfileResponse } from "./types.js";

const rank: Record<AssistanceLevel, number> = { A0: 0, A1: 1, A2: 2, A3: 3, A4: 4, A5: 5 };
const modeCeiling: Record<ManualRequest["mode"], AssistanceLevel> = {
  training: "A3",
  pair: "A5",
  assessment: "A1",
};
const profileCeiling: Record<Profile, AssistanceLevel> = {
  coach: "A5",
  inspect: "A3",
  assess: "A1",
  debrief: "A3",
};

export function minimumAssistance(...levels: AssistanceLevel[]): AssistanceLevel {
  return levels.reduce((lowest, current) => (rank[current] < rank[lowest] ? current : lowest));
}

export function effectiveAssistanceCeiling(request: ManualRequest): AssistanceLevel {
  return minimumAssistance(request.allowed_assistance, modeCeiling[request.mode], profileCeiling[request.profile]);
}

export function validateAssistance(request: ManualRequest, response: ProfileResponse): void {
  const ceiling = effectiveAssistanceCeiling(request);
  const actual = response.intervention.assistance_level;

  if (response.request_id !== request.request_id) throw new Error("Response request_id does not match the request.");
  if (response.profile !== request.profile) throw new Error("Response profile does not match the request.");
  if (rank[actual] > rank[ceiling]) {
    throw new Error(`Response assistance ${actual} exceeds the effective ceiling ${ceiling}.`);
  }
  if (request.mode === "assessment" && response.intervention.contains_complete_solution) {
    throw new Error("Assessment mode cannot contain a complete solution.");
  }
  if (response.intervention.contains_complete_solution && rank[actual] < rank.A4) {
    throw new Error("A complete solution must be classified as A4 or A5 assistance.");
  }
  if (request.mode === "training" && response.checkpoint.trim().length === 0) {
    throw new Error("Training responses require a learner checkpoint.");
  }
}

export function assistancePolicyText(request: ManualRequest): string {
  const ceiling = effectiveAssistanceCeiling(request);
  return [
    `The hard assistance ceiling for this response is ${ceiling}. Never exceed it.`,
    "A0 = observation only; A1 = diagnostic question; A2 = directional hint; A3 = localized guidance; A4 = partial implementation; A5 = complete solution.",
    request.mode === "assessment" ? "Assessment mode forbids answers, patches, and complete solutions. Ask one discriminating question or give an observation." : "",
    request.mode === "training" ? "Training mode must leave the learner with a concrete action and checkpoint; do not remove the productive struggle." : "",
  ].filter(Boolean).join("\n");
}
