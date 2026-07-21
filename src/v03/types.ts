import type { AssistanceLevel } from "../v01/types.js";
import type { AmbientContextDecision, AmbientState, AmbientUpdate } from "../v02/types.js";

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
export type InterpretationSource = "explicit" | "inferred" | "unknown" | "confirmed";

export interface InterpretedValue<T> {
  value: T | null;
  source: InterpretationSource;
  confidence: number;
  rationale: string;
}

export interface CalibrationInput {
  narrative: string;
}

export type CalibrationField = "current_position" | "available_hours_per_week" | "active_projects" | "growth_edges" | "desired_outcome";
export interface CalibrationCorrectionInput {
  values: Partial<{ current_position: string; available_hours_per_week: number; active_projects: string[]; growth_edges: string[]; desired_outcome: string }>;
  accepted_unknowns: CalibrationField[];
  reason: string;
}
export interface CalibrationAnswer { question: string; answer: string; }

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
  interpreted_profile?: {
    current_position: InterpretedValue<string>;
    available_hours_per_week: InterpretedValue<number>;
    active_projects: InterpretedValue<string[]>;
    growth_edges: InterpretedValue<string[]>;
    desired_outcome: InterpretedValue<string>;
  };
  assumptions?: string[];
  clarification_questions?: string[];
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
  updated_at: string;
  revision: number;
  project: string | null;
  original_objective: string | null;
  input: SetupInput | CalibrationInput | WeekInput | null;
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

export type MemoryScope = "global" | "project";
export interface MemoryRetrievalQuery {
  text: string;
  project?: string | null;
  kinds?: MemoryRecord["kind"][];
  maximum_sensitivity?: MemoryRecord["sensitivity"];
  limit?: number;
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
  schema_version: "0.3.3";
  database_integrity: "ok";
  schema_version_applied: "0.3.3";
  resumed_day_id: string | null;
  pending_draft_kind: "setup" | "week" | "day" | null;
  interrupted_invocations: number;
  observation_requires_manual_resume: boolean;
}

export interface RetentionPolicy {
  schema_version: "0.3.2";
  memory_retention_days: number | null;
  sensitive_memory_retention_days: number;
  context_retention_days: 14;
  telemetry_retention_days: 30;
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
  pending_end_day: EndDayDraft | null;
  recent_context: ContextFrame[];
  context_diagnostics: AmbientContextDecision[];
  retrieval_diagnostics: RetrievalDiagnostic[];
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

export interface EndDayProposal extends EndDayInput {
  schema_version: "0.3.2";
  narrative_summary: string;
  missing_proof: string[];
  carry_forward: string[];
  assumptions: string[];
}

export interface EndDayDraft {
  draft_id: string;
  day_id: string;
  created_at: string;
  narrative: string;
  proposal: EndDayProposal;
}

export interface ContextFrame {
  schema_version: "0.3.2";
  context_id: string;
  occurred_at: string;
  application: string;
  project: string | null;
  activity: string;
  artifact: string | null;
  visible_intent: string;
  active_checkpoint: string | null;
  privacy_classification: "authorized" | "restricted" | "unknown";
  confidence: number;
  ambiguity: string[];
  signal_sources: Array<"active_window" | "accessibility" | "ocr" | "operating_state" | "memory">;
  changed_fields: string[];
  text_digest: string | null;
}

export interface MemoryRetrievalResult {
  memory: MemoryRecord;
  scope: MemoryScope;
  project: string | null;
  score: number;
  lexical_score: number;
  vector_score: number;
  provenance: string;
  retrieval_path: "fts_vector" | "fts_only" | "lexical_fallback";
}

export interface RetrievalDiagnostic {
  retrieval_id: string;
  context_id: string;
  occurred_at: string;
  project: string | null;
  query_hash: string;
  retrieval_path: MemoryRetrievalResult["retrieval_path"] | "none";
  results: Array<{ memory_id: string; score: number; provenance: string }>;
}

export interface PlannerExecution<T> {
  proposal: T;
  duration_ms: number;
  prompt_characters: number;
}

export interface V03Planner {
  draftSetup(input: SetupInput | CalibrationInput, mainGoal: string): Promise<PlannerExecution<SetupProposal>>;
  refineSetup?(input: SetupInput | CalibrationInput, current: SetupProposal, answers: CalibrationAnswer[], mainGoal: string): Promise<PlannerExecution<SetupProposal>>;
  draftWeek(input: WeekInput, profile: OperatingProfile, context: string): Promise<PlannerExecution<WeekProposal>>;
  draftDay(project: string, objective: string, profile: OperatingProfile, context: string): Promise<PlannerExecution<DayProposal>>;
  draftEndDay?(narrative: string, day: DailyPlan, context: string): Promise<PlannerExecution<EndDayProposal>>;
}
