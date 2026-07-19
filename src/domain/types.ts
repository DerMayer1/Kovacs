export type KovacsMode =
  | "training"
  | "pair"
  | "ship"
  | "review"
  | "assessment"
  | "incident"
  | "strategy";

export type ObservationKind =
  | "manual"
  | "repeated_error"
  | "test_failed"
  | "test_passed"
  | "build_failed"
  | "build_passed"
  | "stuck"
  | "commit"
  | "meeting_question"
  | "social_draft"
  | "window_changed";

export type Sensitivity = "normal" | "sensitive" | "restricted";

export interface ObservationInput {
  kind: ObservationKind;
  source: string;
  summary: string;
  payload?: Record<string, unknown>;
  sensitivity?: Sensitivity;
  imagePath?: string;
  project?: string;
}

export interface Observation extends ObservationInput {
  id: number;
  occurredAt: string;
  processedAt: string | null;
}

export interface MemoryRecordInput {
  namespace: string;
  key: string;
  content: string;
  source: string;
  confidence: number;
  sensitivity?: Sensitivity;
  expiresAt?: string;
  evidenceReference?: string;
}

export interface MemoryRecord extends MemoryRecordInput {
  id: number;
  createdAt: string;
  updatedAt: string;
}

export interface InterventionDecision {
  shouldIntervene: boolean;
  score: number;
  reason: string;
}

export interface RuntimeStatus {
  databasePath: string;
  initializedAt: string | null;
  codexThreadId: string | null;
  observations: number;
  interventions: number;
  memories: number;
}
