import path from "node:path";
import type { ActiveWindowInfo, AmbientSettings } from "./types.js";

export interface WindowAuthorization {
  allowed: boolean;
  reason: "allowed_application" | "denied_title" | "unknown_application" | "empty_window";
}

export function authorizeWindow(window: ActiveWindowInfo | null, settings: AmbientSettings): WindowAuthorization {
  if (!window?.application.trim() || !window.title.trim()) return { allowed: false, reason: "empty_window" };
  const title = window.title.toLocaleLowerCase();
  if (settings.denied_title_patterns.some((pattern) => title.includes(pattern.toLocaleLowerCase()))) {
    return { allowed: false, reason: "denied_title" };
  }
  const application = path.basename(window.application).toLocaleLowerCase();
  const allowed = settings.allowed_applications.some((candidate) => candidate.toLocaleLowerCase() === application);
  return allowed ? { allowed: true, reason: "allowed_application" } : { allowed: false, reason: "unknown_application" };
}
