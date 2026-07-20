import type { AssistanceLevel } from "../v01/types.js";
import type { AmbientState, AmbientUpdate } from "../v02/types.js";

export const COMPETENCIES = [
  "software_design_implementation",
  "ai_systems",
  "debugging_operational_judgment",
  "architecture",
  "testing_reliability",
  "security_privacy",
  "product_judgment",
  "technical_communication",
  "leadership_leverage",
  "execution_ownership",
] as const;

export const COMPETENCY_LEVELS = ["unverified", "emerging", "practiced", "reliable", "independent", "leverage"] as const;
export const DAY_OUTCOMES = ["achieved", "partially_achieved", "blocked", "misdirected"] as const;
export const EVIDENCE_SOURCES = ["self_reported", "observed", "tool_verified", "artifact_verified", "reviewed"] as const;
export const CHECKPOINT_STATUSES = ["pending", "active", "completed", "blocked", "deferred", "abandoned"] as const;
export const INTERVENTION_FEEDBACK_KINDS = ["useful", "not_useful", "wrong_context", "unnecessary_interruption", "already_known", "expanded"] as const;

export type Competency = (typeof COMPETENCIES)[number];
export type CompetencyLevel = (typeof COMPETENCY_LEVELS)[number];
export type DayOutcome = (typeof DAY_OUTCOMES)[number];
export type EvidenceSource = (typeof EVIDENCE_SOURCES)[number];
export type CheckpointStatus = (typeof CHECKPOINT_STATUSES)[number];
export type InterventionFeedbackKind = (typeof INTERVENTION_FEEDBACK_KINDS)[number];
export type MemoryStatus = "active" | "pending_confirmation";

export interface SetupInput {
  current_position: string;
  available_hours_per_week: number;
  active_projects: string;
  weaknesses: string;
  desired_outcome: string;
}

export interface SetupProposal {
  schema_version: "0.3.0";
  mission_title: string;
  mission_success_criteria: string[];
  weekly_outcome: string;
  weekly_success_criteria: string[];
  weekly_competencies: Competency[];
  rationale: string;
  warnings: string[];
}

export interface WeekInput {
  priorities: string;
  constraints: string;
}

export interface WeekProposal {
  schema_version: "0.3.0";
  primary_outcome: string;
  success_criteria: string[];
  competencies: Competency[];
  rationale: string;
  warnings: string[];
}

export interface DayProposal {
  schema_version: "0.3.0";
  proposed_objective: string;
  objective_changed: boolean;
  success_criteria: string[];
  checkpoints: Array<{
    title: string;
    evidence_required: string;
    competency: Competency;
  }>;
  rationale: string;
  warnings: string[];
}

export interface PendingDraft<T extends SetupProposal | WeekProposal | DayProposal> {
  draft_id: string;
  kind: "setup" | "week" | "day";
  created_at: string;
  project: string | null;
  original_objective: string | null;
  input: SetupInput | WeekInput | null;
  proposal: T;
}

export interface OperatingProfile {
  schema_version: "0.3.0";
  main_goal: string;
  mission: {
    title: string;
    success_criteria: string[];
    starts_at: string;
    target_date: string;
  };
  week: {
    primary_outcome: string;
    success_criteria: string[];
    competencies: Competency[];
    starts_at: string;
  };
  created_at: string;
  updated_at: string;
}

export interface Checkpoint {
  checkpoint_id: string;
  day_id: string;
  position: number;
  title: string;
  evidence_required: string;
  competency: Competency;
  status: CheckpointStatus;
  status_reason: string | null;
  completed_at: string | null;
}

export interface DailyPlan {
  schema_version: "0.3.0";
  day_id: string;
  ambient_day_id: string;
  project: string;
  original_objective: string;
  objective: string;
  success_criteria: string[];
  status: "active" | "ended";
  outcome: DayOutcome | null;
  output_summary: string | null;
  validation_summary: string | null;
  lesson: string | null;
  started_at: string;
  ended_at: string | null;
  checkpoints: Checkpoint[];
  revision: number;
  deterministic_summary: DaySummary | null;
}

export interface DaySummary {
  schema_version: "0.3.1";
  planned_objective: string;
  final_objective: string;
  planned_checkpoints: number;
  completed_checkpoints: number;
  blocked_checkpoints: number;
  deferred_checkpoints: number;
  abandoned_checkpoints: number;
  incomplete_checkpoints: number;
  output_summary: string;
  validation_summary: string;
  lesson: string;
  outcome: DayOutcome;
  weekly_outcome: string;
  carry_forward: string[];
}

export interface EvidenceRecord {
  schema_version: "0.3.0";
  evidence_id: string;
  day_id: string;
  checkpoint_id: string | null;
  project: string;
  competency: Competency;
  source: EvidenceSource;
  assistance_level: AssistanceLevel;
  outcome: DayOutcome;
  confidence: number;
  summary: string;
  validation: string | null;
  source_event_id: string | null;
  created_at: string;
}

export interface CompetencyRecord {
  competency: Competency;
  level: CompetencyLevel;
  confidence: number;
  evidence_count: number;
  last_evidence_at: string | null;
}

export interface MemoryRecord {
  schema_version: "0.3.0";
  memory_id: string;
  kind: "main_goal" | "routine" | "context" | "pattern" | "lesson";
  claim: string;
  source: "user_stated" | "observed" | "inferred" | "verified";
  confidence: number;
  sensitivity: "public" | "internal" | "sensitive";
  status: MemoryStatus;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface UsageSummary {
  invocation_count: number;
  prompt_characters: number;
  response_characters: number;
  total_latency_ms: number;
  image_invocations: number;
  failed_invocations: number;
  interrupted_invocations: number;
  discarded_invocations: number;
  average_latency_ms: number;
}

export interface RecoveryStatus {
  schema_version: "0.3.1";
  database_integrity: "ok";
  schema_version_applied: "0.3.1";
  resumed_day_id: string | null;
  pending_draft_kind: "setup" | "week" | "day" | null;
  interrupted_invocations: number;
  observation_requires_manual_resume: boolean;
}

export interface RetentionPolicy {
  schema_version: "0.3.1";
  memory_retention_days: number | null;
  sensitive_memory_retention_days: number;
  persist_window_titles: false;
  last_pruned_at: string | null;
}

export interface InterventionFeedback {
  feedback_id: string;
  request_id: string;
  day_id: string | null;
  kind: InterventionFeedbackKind;
  note: string | null;
  created_at: string;
}

export interface OperatingSnapshot {
  profile: OperatingProfile | null;
  active_day: DailyPlan | null;
  pending_setup: PendingDraft<SetupProposal> | null;
  pending_week: PendingDraft<WeekProposal> | null;
  pending_day: PendingDraft<DayProposal> | null;
  competencies: CompetencyRecord[];
  recent_evidence: EvidenceRecord[];
  memories: MemoryRecord[];
  usage_today: UsageSummary;
  recovery: RecoveryStatus;
  retention: RetentionPolicy;
  recent_feedback: InterventionFeedback[];
}

export interface V03Update {
  ambient: AmbientState | null;
  operating: OperatingSnapshot;
  response?: AmbientUpdate["response"];
  message: string;
}

export interface CheckpointCompletionInput {
  checkpoint_id: string;
  outcome: Exclude<DayOutcome, "misdirected">;
  result: string;
  validation: string;
  assistance_level: AssistanceLevel;
  evidence_source?: Extract<EvidenceSource, "self_reported" | "tool_verified" | "artifact_verified">;
}

export interface CheckpointTransitionInput {
  checkpoint_id: string;
  status: Extract<CheckpointStatus, "active" | "blocked" | "deferred" | "abandoned">;
  reason: string;
}

export interface ObjectiveRevisionInput {
  objective: string;
  reason: string;
}

export interface EndDayInput {
  outcome: DayOutcome;
  output_summary: string;
  validation_summary: string;
  lesson: string;
  evidence_source?: Extract<EvidenceSource, "self_reported" | "tool_verified" | "artifact_verified">;
}

export interface PlannerExecution<T> {
  proposal: T;
  duration_ms: number;
  prompt_characters: number;
}

export interface V03Planner {
  draftSetup(input: SetupInput, mainGoal: string): Promise<PlannerExecution<SetupProposal>>;
  draftWeek(input: WeekInput, profile: OperatingProfile, context: string): Promise<PlannerExecution<WeekProposal>>;
  draftDay(project: string, objective: string, profile: OperatingProfile, context: string): Promise<PlannerExecution<DayProposal>>;
}
