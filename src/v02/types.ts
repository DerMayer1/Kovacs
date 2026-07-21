import type { ProfileResponse } from "../v01/types.js";

export type AmbientStatus = "idle" | "observing" | "paused" | "private" | "ended";
export type AmbientUrgency = "normal" | "important" | "critical";
export type AmbientEventType = "day_started" | "status_changed" | "window_authorized" | "window_blocked" | "screen_changed" | "focus_drift" | "manual_observe" | "intervention" | "day_ended" | "error";

export interface AmbientEvent {
  event_id: string;
  occurred_at: string;
  type: AmbientEventType;
  urgency: AmbientUrgency;
  application: string | null;
  window_title: string | null;
  objective: string;
  summary: string;
  frame_attached: boolean;
  intervention_request_id: string | null;
}

export interface AmbientState {
  schema_version: "0.2.0";
  day_id: string;
  status: AmbientStatus;
  main_goal: string;
  objective: string;
  project: string;
  session_id: string;
  started_at: string;
  ended_at: string | null;
  last_capture_at: string | null;
  last_intervention_at: string | null;
  events: AmbientEvent[];
}

export interface AmbientSettings {
  schema_version: "0.2.0";
  main_goal: string;
  allowed_applications: string[];
  denied_title_patterns: string[];
  sample_interval_ms: number;
  automatic_intervention_interval_ms: number;
  focus_drift_ms: number;
  manual_window_grace_ms: number;
  frame_difference_threshold: number;
  automatic_interventions: boolean;
}

export interface ActiveWindowInfo {
  application: string;
  title: string;
  windowId?: number;
}

export interface CapturedFrame {
  sample: Buffer;
  png: Buffer;
}

export interface WindowProbe { getActiveWindow(): Promise<ActiveWindowInfo | null>; }
export interface FrameCapture { capture(window: ActiveWindowInfo): Promise<CapturedFrame | null>; }

export interface AmbientUpdate {
  state: AmbientState | null;
  response?: ProfileResponse;
  message: string;
}

export interface AmbientReasoningTelemetry {
  reason: "automatic_observation" | "manual_observation" | "end_day";
  urgency: AmbientUrgency;
  occurred_at: string;
  duration_ms: number;
  prompt_characters: number;
  image_attached: boolean;
  cached: boolean;
  outcome: "displayed" | "failed";
}

export interface AmbientControllerOptions {
  operatingContext?: () => string | Promise<string>;
  contextualize?: (window: ActiveWindowInfo, imagePath: string) => string | Promise<string>;
  onReasoningComplete?: (telemetry: AmbientReasoningTelemetry) => void | Promise<void>;
}
