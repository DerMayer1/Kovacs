export const PROFILES = ["coach", "inspect", "assess", "debrief"] as const;
export const MODES = ["training", "pair", "assessment"] as const;
export const ASSISTANCE_LEVELS = ["A0", "A1", "A2", "A3", "A4", "A5"] as const;
export const SENSITIVITY_LEVELS = ["public", "internal", "sensitive", "restricted"] as const;

export type Profile = (typeof PROFILES)[number];
export type Mode = (typeof MODES)[number];
export type AssistanceLevel = (typeof ASSISTANCE_LEVELS)[number];
export type Sensitivity = (typeof SENSITIVITY_LEVELS)[number];

export interface RequestContext {
  terminal: string;
  notes: string;
  selected_files: string[];
}

export interface ManualRequest {
  schema_version: "0.1.0";
  request_id: string;
  session_id: string;
  profile: Profile;
  mode: Mode;
  project: string;
  task: string;
  current_hypothesis: string | null;
  attempts: string[];
  requested_help: string;
  allowed_assistance: AssistanceLevel;
  sensitivity: Sensitivity;
  context: RequestContext;
}

export interface MemoryCandidate {
  candidate_id: string;
  memory_type: "working" | "episodic" | "semantic" | "evidence" | "commitment" | "pattern" | "curriculum" | "professional";
  claim: string;
  epistemic_status: "user_stated" | "observed" | "inferred" | "verified";
  source_event_ids: string[];
  confidence: number;
  sensitivity: "public" | "internal" | "sensitive";
  retention: "ephemeral" | "session" | "30d" | "90d" | "until_review";
  expires_at: string | null;
  evidence_reference: string | null;
  requires_confirmation: boolean;
  policy_version: "v0.1.0";
}

export interface ProfileResponse {
  schema_version: "0.1.0";
  request_id: string;
  profile: Profile;
  recommendation: string;
  assessment: string;
  intervention: {
    type: string;
    message: string;
    assistance_level: AssistanceLevel;
    contains_complete_solution: boolean;
  };
  reason: string;
  observed_context: string[];
  checkpoint: string;
  memory_candidates: MemoryCandidate[];
  external_action_requests: never[];
}

export interface SessionEvent {
  event_id: string;
  occurred_at: string;
  type: "session_started" | "request_accepted" | "request_blocked" | "gateway_failed" | "response_rejected" | "intervention_displayed" | "session_completed";
  request_id: string | null;
  payload: Record<string, unknown>;
}

export interface SessionRecord {
  schema_version: "0.1.0";
  session_id: string;
  project: string;
  task: string;
  mode: Mode;
  status: "active" | "completed";
  started_at: string;
  ended_at: string | null;
  events: SessionEvent[];
}

export interface PreparedContext {
  terminal: string | null;
  notes: string | null;
  files: Array<{ path: string; content: string }>;
  redaction_count: number;
  truncated: boolean;
  total_characters: number;
}

export interface GatewayInvocation {
  request: ManualRequest;
  project: string;
  prompt: string;
  imagePaths?: string[];
  outputSchemaPath?: string;
}

export interface GatewayExecution {
  response: unknown;
  trace: string[];
  stderr: string;
  duration_ms: number;
}

export interface ReasoningGateway {
  execute(invocation: GatewayInvocation): Promise<GatewayExecution>;
}

export interface ServiceResult {
  response: ProfileResponse;
  cached: boolean;
  redaction_count: number;
  context_truncated: boolean;
  gateway_duration_ms: number;
  prompt_characters: number;
}
