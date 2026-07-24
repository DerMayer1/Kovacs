import type { ProfileResponse } from "../coaching/types.js";
import type { SensitiveContentCategory } from "../security/sensitive-content.js";

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

export interface AmbientLocalPerceptionResult {
  context_id: string;
  occurred_at: string;
  context: string;
  fingerprint: string;
  semantic_fingerprint: string;
  confidence: number;
  sufficient: boolean;
  conflicting: boolean;
  deterministic_trigger: boolean;
  prompt_injection_detected: boolean;
  sensitive_content_detected: boolean;
  sensitive_categories: SensitiveContentCategory[];
  screenshot_blocked_reason: "sensitive_content" | "ocr_unavailable" | null;
  changed_fields: string[];
  screenshot: Buffer | null;
  capture_used: boolean;
  ocr_used: boolean;
}

export type AmbientContextDecisionKind = "call" | "silence";
export interface AmbientContextDecision {
  occurred_at: string;
  context_id: string;
  application: string;
  confidence: number;
  perception_path: "uia" | "uia_ocr" | "uia_ocr_screenshot";
  decision: AmbientContextDecisionKind;
  reason: "manual" | "private_or_unauthorized" | "untrusted_instruction" | "conflicting_signals" | "low_confidence" | "medium_confidence" | "awaiting_stability" | "weak_delta" | "same_context_cooldown" | "suppressed_by_feedback" | "stable_strong_delta" | "deterministic_trigger" | "unchanged";
  changed_fields: string[];
  fingerprint: string;
  semantic_fingerprint: string;
  image_attached: boolean;
  sensitive_categories: SensitiveContentCategory[];
  screenshot_blocked_reason: AmbientLocalPerceptionResult["screenshot_blocked_reason"];
  bypass_global_cooldown: boolean;
}

export interface AmbientContextEvent {
  kind: "intervention" | "feedback" | "checkpoint" | "evidence" | "end_day";
  occurred_at: string;
  context_id: string;
  reference_id: string | null;
  retention_class: "event" | "evidence";
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

export interface ObservationControllerOptions {
  operatingContext?: () => string | Promise<string>;
  localPerception?: (window: ActiveWindowInfo, capture: () => Promise<CapturedFrame | null>) => AmbientLocalPerceptionResult | Promise<AmbientLocalPerceptionResult>;
  onContextDecision?: (decision: AmbientContextDecision) => void | Promise<void>;
  onContextEvent?: (event: AmbientContextEvent) => void | Promise<void>;
  onWorkingContextCleared?: () => void | Promise<void>;
  onReasoningComplete?: (telemetry: AmbientReasoningTelemetry) => void | Promise<void>;
}
