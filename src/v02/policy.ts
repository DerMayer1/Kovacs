import type { ActiveWindowInfo, AmbientSettings, AmbientUrgency } from "./types.js";

const CRITICAL_TERMS = ["production", "prod deploy", "drop database", "force push", "delete cluster", "rotate secret"];

export function classifyUrgency(window: ActiveWindowInfo, manual: boolean): AmbientUrgency {
  const searchable = `${window.application} ${window.title}`.toLocaleLowerCase();
  if (CRITICAL_TERMS.some((term) => searchable.includes(term))) return "critical";
  return manual ? "important" : "normal";
}

export function automaticInterventionAllowed(
  settings: AmbientSettings,
  nowMs: number,
  lastInterventionAt: string | null,
  urgency: AmbientUrgency,
  busy: boolean,
): boolean {
  if (busy || !settings.automatic_interventions) return false;
  if (urgency === "critical") return true;
  if (!lastInterventionAt) return true;
  return nowMs - Date.parse(lastInterventionAt) >= settings.automatic_intervention_interval_ms;
}
