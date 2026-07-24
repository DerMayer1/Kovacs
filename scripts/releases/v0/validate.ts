import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import type { AnySchema, ErrorObject, ValidateFunction } from "ajv";

import {
  evaluateV0Policy,
  type MemoryDisposition,
  type PolicyDecision,
  type V0Event,
} from "./policy.js";
import { V0_SCENARIOS, type V0Scenario } from "./scenarios.js";

interface Metric {
  id: string;
  name: string;
  passed: boolean;
  evidence: string;
}

interface ValidationFailure {
  scenario: string;
  stage: string;
  detail: string;
}

const ROOT = process.cwd();
const REQUIRED_ARTIFACTS = [
  "docs/v0/00_V0_CHARTER.md",
  "docs/v0/01_SYSTEM_ARCHITECTURE.md",
  "docs/v0/02_EVENT_VOCABULARY.md",
  "docs/v0/03_MEMORY_ONTOLOGY.md",
  "docs/v0/04_INTERVENTION_POLICY.md",
  "docs/v0/05_PRIVACY_SECURITY_MODEL.md",
  "docs/v0/06_REASONING_PROFILES.md",
  "docs/v0/07_EXPECTED_VS_UNACCEPTABLE.md",
  "docs/v0/08_ARCHITECTURE_DECISIONS.md",
  "docs/v0/09_SUCCESS_METRICS.md",
  "docs/v0/10_SCENARIO_CATALOG.md",
  "docs/v0/V0_SUCCESS_REPORT.md",
  "contracts/v0/event.schema.json",
  "contracts/v0/memory-candidate.schema.json",
  "contracts/v0/intervention.schema.json",
  "contracts/v0/reasoning-request.schema.json",
  "contracts/v0/reasoning-response.schema.json",
  "contracts/v0/scenario.schema.json",
  "scripts/releases/v0/policy.ts",
  "scripts/releases/v0/scenarios.ts",
  "scripts/releases/v0/validate.ts",
];

const schemaFiles = [
  "event.schema.json",
  "memory-candidate.schema.json",
  "intervention.schema.json",
  "reasoning-request.schema.json",
  "reasoning-response.schema.json",
  "scenario.schema.json",
];

const require = createRequire(import.meta.url);
const Ajv2020 = require("ajv/dist/2020").default as typeof import("ajv/dist/2020.js").Ajv2020;
const addFormats = require("ajv-formats").default as (instance: InstanceType<typeof Ajv2020>) => void;
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);

for (const filename of schemaFiles) {
  ajv.addSchema(readJson(path.join(ROOT, "contracts", "v0", filename)) as AnySchema);
}

const validateScenario = getValidator("https://kovacs.local/contracts/v0/scenario.schema.json");
const validateIntervention = getValidator("https://kovacs.local/contracts/v0/intervention.schema.json");
const validateMemory = getValidator("https://kovacs.local/contracts/v0/memory-candidate.schema.json");
const validateRequest = getValidator("https://kovacs.local/contracts/v0/reasoning-request.schema.json");
const validateResponse = getValidator("https://kovacs.local/contracts/v0/reasoning-response.schema.json");

const failures: ValidationFailure[] = [];
const decisions = new Map<string, PolicyDecision>();
const memoryCandidates: unknown[] = [];
let validScenarios = 0;
let validInterventions = 0;
let validRequests = 0;
let validResponses = 0;
let deterministicReplays = 0;

for (const scenario of V0_SCENARIOS) {
  const scenarioIsValid = Boolean(validateScenario(scenario));
  if (!scenarioIsValid) {
    fail(scenario.id, "scenario_schema", errors(validateScenario.errors));
    continue;
  }
  validScenarios += 1;

  const decision = evaluateV0Policy(scenario.event);
  decisions.set(scenario.id, decision);

  if (!validateIntervention(decision)) {
    fail(scenario.id, "intervention_schema", errors(validateIntervention.errors));
    continue;
  }
  validInterventions += 1;

  compareExpected(scenario, decision);

  const baseline = JSON.stringify(decision);
  const replayed = Array.from({ length: 5 }, () =>
    JSON.stringify(evaluateV0Policy(scenario.event)),
  );
  if (replayed.every((value) => value === baseline)) {
    deterministicReplays += 1;
  } else {
    fail(scenario.id, "determinism", "Policy output changed across five identical replays.");
  }

  const candidate = createMemoryCandidate(scenario.event, decision.memory_disposition);
  if (candidate !== null) {
    memoryCandidates.push(candidate);
    if (!validateMemory(candidate)) {
      fail(scenario.id, "memory_schema", errors(validateMemory.errors));
    }
  }

  if (decision.decision === "intervene") {
    const request = createReasoningRequest(scenario.event, decision);
    if (validateRequest(request)) {
      validRequests += 1;
    } else {
      fail(scenario.id, "request_schema", errors(validateRequest.errors));
    }

    const response = createSimulatedResponse(scenario, decision);
    if (validateResponse(response)) {
      validResponses += 1;
    } else {
      fail(scenario.id, "response_schema", errors(validateResponse.errors));
    }
  }
}

const metrics = buildMetrics();
const passed = metrics.every((metric) => metric.passed) && failures.length === 0;

process.stdout.write(
  `${JSON.stringify(
    {
      release: "Kovacs V0",
      passed,
      scenario_count: V0_SCENARIOS.length,
      valid_scenarios: validScenarios,
      valid_interventions: validInterventions,
      intervention_scenarios: [...decisions.values()].filter(
        (decision) => decision.decision === "intervene",
      ).length,
      valid_reasoning_requests: validRequests,
      valid_reasoning_responses: validResponses,
      valid_memory_candidates: memoryCandidates.length,
      deterministic_replays: deterministicReplays,
      metric_summary: `${metrics.filter((metric) => metric.passed).length}/${metrics.length}`,
      metrics,
      failures,
    },
    null,
    2,
  )}\n`,
);

if (!passed) {
  process.exitCode = 1;
}

function buildMetrics(): Metric[] {
  const missing = REQUIRED_ARTIFACTS.filter(
    (relativePath) => !fs.existsSync(path.join(ROOT, relativePath)),
  );
  const restricted = V0_SCENARIOS.filter(
    (scenario) => scenario.event.privacy.sensitivity === "restricted",
  );
  const missingConsent = V0_SCENARIOS.filter(
    (scenario) =>
      scenario.event.source.adapter === "meeting" &&
      scenario.event.privacy.consent !== "granted",
  );
  const eligibleCritical = V0_SCENARIOS.filter(
    (scenario) =>
      scenario.event.type.startsWith("risk.") &&
      ["high", "critical"].includes(scenario.event.features.consequence) &&
      scenario.event.privacy.sensitivity !== "restricted" &&
      !(
        scenario.event.source.adapter === "meeting" &&
        scenario.event.privacy.consent !== "granted"
      ),
  );
  const focusProtected = V0_SCENARIOS.filter(
    (scenario) =>
      scenario.event.features.focus_state === "deep" &&
      !scenario.event.features.explicit_user_request &&
      !scenario.event.type.startsWith("risk.") &&
      scenario.event.features.repetition_count < 3,
  );
  const injectionCases = V0_SCENARIOS.filter(
    (scenario) => scenario.event.privacy.contains_untrusted_instructions,
  );
  const interventionCount = [...decisions.values()].filter(
    (decision) => decision.decision === "intervene",
  ).length;
  const optionADoc = fs.existsSync(path.join(ROOT, "docs/v0/01_SYSTEM_ARCHITECTURE.md"))
    ? fs.readFileSync(path.join(ROOT, "docs/v0/01_SYSTEM_ARCHITECTURE.md"), "utf8")
    : "";
  const optionATokens = [
    "codex exec",
    "--ephemeral",
    "--json",
    "--sandbox read-only",
    "--output-schema",
    "timeout",
  ];
  const v0Code = ["scripts/releases/v0/policy.ts", "scripts/releases/v0/scenarios.ts"]
    .map((file) => fs.readFileSync(path.join(ROOT, file), "utf8"))
    .join("\n");
  const forbiddenSensorImplementations = [
    "Windows.Graphics.Capture",
    "desktopCapturer",
    "getDisplayMedia(",
    "MediaRecorder(",
    "registerHotKey(",
  ].filter((token) => v0Code.includes(token));

  return [
    metric("M01", "Normative artifact completeness", missing.length === 0, missing.length === 0 ? `${REQUIRED_ARTIFACTS.length}/${REQUIRED_ARTIFACTS.length} artifacts present.` : `Missing: ${missing.join(", ")}`),
    metric("M02", "Scenario contract validity", validScenarios === V0_SCENARIOS.length, `${validScenarios}/${V0_SCENARIOS.length} scenarios validate.`),
    metric("M03", "Intervention contract validity", validInterventions === V0_SCENARIOS.length, `${validInterventions}/${V0_SCENARIOS.length} decisions validate.`),
    metric("M04", "Deterministic replay", deterministicReplays === V0_SCENARIOS.length, `${deterministicReplays}/${V0_SCENARIOS.length} scenarios stable across five replays.`),
    metric("M05", "Restricted-data hard gate", restricted.every((scenario) => isBlockedSafely(scenario.id)), `${restricted.filter((scenario) => isBlockedSafely(scenario.id)).length}/${restricted.length} restricted cases blocked.`),
    metric("M06", "Meeting-consent hard gate", missingConsent.every((scenario) => isBlockedSafely(scenario.id)), `${missingConsent.filter((scenario) => isBlockedSafely(scenario.id)).length}/${missingConsent.length} missing-consent cases blocked.`),
    metric("M07", "Critical-risk recall", eligibleCritical.every((scenario) => decisions.get(scenario.id)?.decision === "intervene"), `${eligibleCritical.filter((scenario) => decisions.get(scenario.id)?.decision === "intervene").length}/${eligibleCritical.length} eligible critical risks intervene.`),
    metric("M08", "Focus protection", focusProtected.every((scenario) => ["silence", "record_only"].includes(decisions.get(scenario.id)?.decision ?? "")), `${focusProtected.filter((scenario) => ["silence", "record_only"].includes(decisions.get(scenario.id)?.decision ?? "")).length}/${focusProtected.length} low-value focus cases protected.`),
    metric("M09", "Explainable decisions", [...decisions.values()].every((decision) => decision.reason_codes.length > 0), `${[...decisions.values()].filter((decision) => decision.reason_codes.length > 0).length}/${decisions.size} decisions include reason codes.`),
    metric("M10", "Memory provenance and retention", memoryCandidates.every((candidate) => validateMemory(candidate)), `${memoryCandidates.length} generated candidates validate with provenance and retention.`),
    metric("M11", "Reasoning request/response contracts", validRequests === interventionCount && validResponses === interventionCount, `${validRequests}/${interventionCount} requests and ${validResponses}/${interventionCount} responses validate.`),
    metric("M12", "No external actions", [...decisions.values()].every((decision) => decision.external_action_allowed === false), `${decisions.size}/${decisions.size} decisions prohibit external actions.`),
    metric("M13", "Prompt-injection containment", injectionCases.every((scenario) => decisions.get(scenario.id)?.external_action_allowed === false && decisions.get(scenario.id)?.codex_allowed === false), `${injectionCases.filter((scenario) => decisions.get(scenario.id)?.external_action_allowed === false && decisions.get(scenario.id)?.codex_allowed === false).length}/${injectionCases.length} observed-instruction cases contained.`),
    metric("M14", "Option A execution contract", optionATokens.every((token) => optionADoc.includes(token)), `${optionATokens.filter((token) => optionADoc.includes(token)).length}/${optionATokens.length} required codex exec semantics documented.`),
    metric("M15", "V0 scope contains no sensor implementation", forbiddenSensorImplementations.length === 0, forbiddenSensorImplementations.length === 0 ? "No screen, audio, or hotkey implementation exists in V0 code." : `Found: ${forbiddenSensorImplementations.join(", ")}`),
    metric("M16", "Expected outcomes and unacceptable behaviors", failures.length === 0, failures.length === 0 ? `${V0_SCENARIOS.length}/${V0_SCENARIOS.length} scenarios match expected behavior.` : `${failures.length} validation failures.`),
  ];
}

function compareExpected(scenario: V0Scenario, decision: PolicyDecision): void {
  const checks: Array<[string, unknown, unknown]> = [
    ["decision", decision.decision, scenario.expected.decision],
    ["intervention_type", decision.intervention_type, scenario.expected.intervention_type],
    ["reason_code", decision.reason_codes[0], scenario.expected.reason_code],
    ["memory_disposition", decision.memory_disposition, scenario.expected.memory_disposition],
  ];
  for (const [field, actual, expected] of checks) {
    if (actual !== expected) {
      fail(scenario.id, "expected_behavior", `${field}: expected ${String(expected)}, received ${String(actual)}.`);
    }
  }
}

function createMemoryCandidate(event: V0Event, disposition: MemoryDisposition): unknown | null {
  if (!["episodic_candidate", "evidence_candidate", "commitment_candidate"].includes(disposition)) {
    return null;
  }
  const memoryType = disposition.replace("_candidate", "");
  const evidenceReference = memoryType === "evidence"
    ? String(event.payload.artifact_reference)
    : null;
  const expiresAt = memoryType === "episodic"
    ? "2026-08-18T18:00:00Z"
    : null;
  return {
    candidate_id: `mem_${event.event_id.replace("evt_", "")}`,
    memory_type: memoryType,
    claim: `Governed candidate derived from ${event.type}.`,
    epistemic_status: memoryType === "evidence" ? "verified" : "observed",
    source_event_ids: [event.event_id],
    confidence: memoryType === "evidence" ? 1 : 0.85,
    sensitivity: event.privacy.sensitivity === "restricted" ? "sensitive" : event.privacy.sensitivity,
    retention: memoryType === "episodic" ? "30d" : "until_review",
    expires_at: expiresAt,
    evidence_reference: evidenceReference,
    requires_confirmation: memoryType === "commitment",
    policy_version: "v0.1.0",
  };
}

function createReasoningRequest(event: V0Event, decision: PolicyDecision): unknown {
  const profile = event.context.mode === "assessment"
    ? "assess"
    : event.context.mode === "incident"
      ? "incident"
      : event.type.startsWith("social.") || event.type.startsWith("document.")
        ? "review"
        : "coach";
  return {
    schema_version: "0.1.0",
    request_id: `req_${event.event_id.replace("evt_", "")}`,
    profile,
    mode: event.context.mode,
    allowed_assistance: decision.assistance_level,
    allowed_actions: ["advise"],
    event,
    policy_decision: decision,
    selected_context: {
      current_objective: event.context.task ?? null,
      project_facts: [],
      learner_evidence: [],
      recent_attempts: [],
    },
  };
}

function createSimulatedResponse(scenario: V0Scenario, decision: PolicyDecision): unknown {
  return {
    schema_version: "0.1.0",
    request_id: `req_${scenario.event.event_id.replace("evt_", "")}`,
    recommendation: "display",
    intervention_type: decision.intervention_type,
    message: "Simulation placeholder: bounded intervention would be generated here.",
    reason: decision.reason_codes.join(", "),
    confidence: 1,
    assistance_level: decision.assistance_level,
    checkpoint: "Produce the next policy-appropriate evidence.",
    memory_candidates: [],
    external_action_requests: [],
  };
}

function isBlockedSafely(id: string): boolean {
  const decision = decisions.get(id);
  return decision?.decision === "block" &&
    decision.codex_allowed === false &&
    decision.raw_retention === "none" &&
    decision.external_action_allowed === false;
}

function metric(id: string, name: string, passed: boolean, evidence: string): Metric {
  return { id, name, passed, evidence };
}

function fail(scenario: string, stage: string, detail: string): void {
  failures.push({ scenario, stage, detail });
}

function errors(value: ErrorObject[] | null | undefined): string {
  return value?.map((error) => `${error.instancePath || "/"} ${error.message ?? "invalid"}`).join("; ") ?? "Unknown validation error";
}

function readJson(filename: string): unknown {
  return JSON.parse(fs.readFileSync(filename, "utf8")) as unknown;
}

function getValidator(id: string): ValidateFunction {
  const validator = ajv.getSchema(id);
  if (validator === undefined) {
    throw new Error(`Schema was not registered: ${id}`);
  }
  return validator;
}
