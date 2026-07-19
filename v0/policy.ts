export const POLICY_VERSION = "v0.1.0" as const;

export type Decision = "silence" | "record_only" | "intervene" | "block";
export type InterventionType =
  | "none"
  | "observation"
  | "diagnostic_question"
  | "hint"
  | "information"
  | "warning"
  | "direct_instruction"
  | "review_offer"
  | "assessment_prompt";
export type MemoryDisposition =
  | "none"
  | "audit_only"
  | "episodic_candidate"
  | "evidence_candidate"
  | "commitment_candidate"
  | "professional_candidate";

export interface V0Event {
  schema_version: "0.1.0";
  event_id: string;
  occurred_at: string;
  source: {
    adapter:
      | "manual"
      | "editor"
      | "terminal"
      | "git"
      | "test_runner"
      | "meeting"
      | "social"
      | "screen"
      | "system";
    instance?: string;
  };
  type: string;
  context: {
    project?: string;
    task?: string;
    mode:
      | "training"
      | "pair"
      | "ship"
      | "review"
      | "assessment"
      | "incident"
      | "strategy";
  };
  features: {
    explicit_user_request: boolean;
    urgency: "low" | "normal" | "high" | "critical";
    consequence: "none" | "low" | "medium" | "high" | "critical";
    repetition_count: number;
    stuck_minutes: number;
    focus_state: "none" | "shallow" | "deep";
    cooldown_active: boolean;
  };
  privacy: {
    sensitivity: "public" | "internal" | "sensitive" | "restricted";
    consent: "not_required" | "granted" | "denied" | "unknown";
    contains_untrusted_instructions: boolean;
  };
  payload: Record<string, unknown>;
  raw_artifacts: Array<{
    kind: "screenshot" | "audio" | "transcript" | "ocr" | "file" | "terminal_excerpt";
    reference: string;
    retention: "ephemeral" | "session" | "30d" | "until_review";
  }>;
}

export interface PolicyDecision {
  policy_version: typeof POLICY_VERSION;
  event_id: string;
  decision: Decision;
  intervention_type: InterventionType;
  assistance_level: "A0" | "A1" | "A2" | "A3" | "A4" | "A5" | "A6";
  reason_codes: string[];
  confidence: number;
  urgency: "low" | "normal" | "high" | "critical";
  codex_allowed: boolean;
  external_action_allowed: false;
  memory_disposition: MemoryDisposition;
  raw_retention: "none" | "ephemeral" | "session";
  message: string | null;
  checkpoint: string | null;
}

export function evaluateV0Policy(event: V0Event): PolicyDecision {
  if (event.privacy.sensitivity === "restricted") {
    return result(event, "block", "none", "A0", "privacy.restricted", "audit_only");
  }

  if (
    event.source.adapter === "meeting" &&
    event.privacy.consent !== "granted"
  ) {
    return result(event, "block", "none", "A0", "consent.missing", "audit_only");
  }

  if (
    event.type.startsWith("risk.") &&
    (event.features.consequence === "high" ||
      event.features.consequence === "critical")
  ) {
    return result(event, "intervene", "warning", "A2", "risk.critical", "none");
  }

  if (event.features.explicit_user_request) {
    if (event.type === "user.assessment_requested") {
      return result(
        event,
        "intervene",
        "assessment_prompt",
        "A0",
        "user.explicit_request",
        "none",
      );
    }
    if (event.type === "social.draft_ready" || event.type === "document.review_requested") {
      return result(
        event,
        "intervene",
        "review_offer",
        "A2",
        "user.explicit_request",
        "none",
      );
    }
    return result(
      event,
      "intervene",
      "diagnostic_question",
      "A2",
      "user.explicit_request",
      "none",
    );
  }

  if (event.features.cooldown_active) {
    return result(event, "record_only", "none", "A0", "cooldown.active", memoryFor(event));
  }

  if (
    event.features.focus_state === "deep" &&
    (event.features.urgency === "low" || event.features.urgency === "normal") &&
    event.features.repetition_count < 3
  ) {
    return result(event, "silence", "none", "A0", "focus.protected", "none");
  }

  if (
    event.type === "difficulty.repeated_failure" &&
    event.features.repetition_count >= 3
  ) {
    return result(
      event,
      "intervene",
      "diagnostic_question",
      "A2",
      "learning.repeated_failure",
      "none",
    );
  }

  if (event.type === "difficulty.stuck" && event.features.stuck_minutes >= 20) {
    return result(
      event,
      "intervene",
      "diagnostic_question",
      "A2",
      "learning.stuck",
      "none",
    );
  }

  if (event.type === "meeting.question_detected") {
    return result(event, "intervene", "information", "A2", "meeting.question", "none");
  }

  if (event.type === "social.draft_ready" || event.type === "document.review_requested") {
    return result(event, "intervene", "review_offer", "A2", "communication.review", "none");
  }

  if (isNormalProgress(event.type)) {
    return result(event, "record_only", "none", "A0", "progress.record", memoryFor(event));
  }

  return result(event, "silence", "none", "A0", "noise.low_value", "none");
}

function result(
  event: V0Event,
  decision: Decision,
  interventionType: InterventionType,
  assistanceLevel: PolicyDecision["assistance_level"],
  reasonCode: string,
  memoryDisposition: MemoryDisposition,
): PolicyDecision {
  const blocked = decision === "block";
  return {
    policy_version: POLICY_VERSION,
    event_id: event.event_id,
    decision,
    intervention_type: interventionType,
    assistance_level: assistanceLevel,
    reason_codes: [reasonCode],
    confidence: 1,
    urgency: event.features.urgency,
    codex_allowed: decision === "intervene",
    external_action_allowed: false,
    memory_disposition: memoryDisposition,
    raw_retention: blocked
      ? "none"
      : event.raw_artifacts.length === 0
        ? "none"
        : "ephemeral",
    message: null,
    checkpoint: null,
  };
}

function isNormalProgress(type: string): boolean {
  return new Set([
    "activity.checkpoint",
    "activity.session_ended",
    "code.diagnostic_observed",
    "code.change_checkpoint",
    "test.run_completed",
    "build.completed",
    "git.commit_created",
    "delivery.deployment_completed",
    "learning.transfer_test_completed",
    "meeting.decision_detected",
    "meeting.commitment_detected",
    "meeting.ended",
  ]).has(type);
}

function memoryFor(event: V0Event): MemoryDisposition {
  if (
    event.type === "learning.transfer_test_completed" &&
    event.payload.verified === true &&
    typeof event.payload.artifact_reference === "string"
  ) {
    return "evidence_candidate";
  }
  if (
    event.type === "meeting.decision_detected" ||
    event.type === "meeting.commitment_detected"
  ) {
    return "commitment_candidate";
  }
  if (
    event.type === "activity.checkpoint" ||
    event.type === "activity.session_ended" ||
    event.type === "code.change_checkpoint" ||
    event.type === "test.run_completed" ||
    event.type === "build.completed" ||
    event.type === "git.commit_created" ||
    event.type === "delivery.deployment_completed"
  ) {
    return "episodic_candidate";
  }
  return "none";
}
