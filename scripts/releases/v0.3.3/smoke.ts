import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createOperatingContracts } from "../../../src/infrastructure/contracts/operating-contracts.js";
import { SqliteOperatingStore } from "../../../src/infrastructure/persistence/sqlite-operating-store.js";
import { LocalContextEngine } from "../../../src/core/context/context-engine.js";
import { PerceptionCascade } from "../../../src/application/observation/perception-cascade.js";
import type { LocalPerceptionAdapter, LocalTextSignal } from "../../../src/infrastructure/windows/windows-perception.js";
import { LocalSensitiveContentGuard } from "../../../src/core/security/local-sensitive-content-guard.js";
import type { SetupProposal } from "../../../src/core/operating-system/types.js";

if (process.platform !== "win32") throw new Error("V0.3.3 smoke is Windows-only.");
const root = path.resolve("."), directory = await mkdtemp(path.join(os.tmpdir(), "kovacs-v033-smoke-"));
const project = path.join(root, "smoke-project");
const contracts = await createOperatingContracts(path.join(root, "contracts"));
const store = await SqliteOperatingStore.create(path.join(directory, "kovacs.db"), contracts);

class SmokePerception implements LocalPerceptionAdapter {
  async readAccessibility(): Promise<LocalTextSignal> { return { text: "", failure: "accessibility_unavailable" }; }
  async readOcr(): Promise<LocalTextSignal> { return { text: "error Client Omega sk-abcdefghijklmnop", failure: null }; }
}

try {
  const proposal: SetupProposal = {
    schema_version: "0.3.0" as const, mission_title: "Prove safe contextual judgment",
    mission_success_criteria: ["Sensitive context is withheld", "Retrieval quality is measured"],
    weekly_outcome: "Validate V0.3.3", weekly_success_criteria: ["The release gate passes"],
    weekly_competencies: ["ai_systems" as const, "security_privacy" as const], rationale: "Trust precedes expansion.", warnings: [],
    interpreted_profile: {
      current_position: { value: "Engineer", source: "explicit" as const, confidence: 1, rationale: "Direct" },
      available_hours_per_week: { value: null, source: "unknown" as const, confidence: 0, rationale: "Missing" },
      active_projects: { value: ["Kovacs"], source: "explicit" as const, confidence: 1, rationale: "Direct" },
      growth_edges: { value: ["Context judgment"], source: "inferred" as const, confidence: 0.7, rationale: "Derived" },
      desired_outcome: { value: "Prove safe contextual judgment", source: "explicit" as const, confidence: 1, rationale: "Direct" },
    }, assumptions: ["Availability is unknown"], clarification_questions: ["How many hours are available?"],
  };
  store.saveSetupDraft({ narrative: "I am building Kovacs." }, proposal);
  const draft = store.snapshot().pending_setup!, revised = structuredClone(proposal);
  revised.interpreted_profile!.available_hours_per_week = { value: 20, source: "confirmed", confidence: 1, rationale: "Learner correction" };
  store.reviseSetupDraft(draft.draft_id, revised, "Correct available time");

  const cascade = new PerceptionCascade(new SmokePerception(), new LocalContextEngine(), new LocalSensitiveContentGuard(["Client Omega"]));
  const perception = await cascade.observe({ window: { application: "Code.exe", title: "Kovacs", windowId: 33 }, project,
    activeCheckpoint: "Validate trust", previous: null, capture: async () => ({ sample: Buffer.alloc(64, 40), png: Buffer.from("raw-sensitive-frame") }) });
  store.recordContextFrame(perception.frame, { kind: "evidence", occurred_at: perception.frame.occurred_at,
    context_id: perception.frame.context_id, reference_id: "v033_smoke", retention_class: "evidence" });
  store.recordContextDecision({ occurred_at: perception.frame.occurred_at, context_id: perception.frame.context_id,
    application: "Code.exe", confidence: perception.frame.confidence, perception_path: "uia_ocr", decision: "silence",
    reason: "medium_confidence", changed_fields: perception.frame.changed_fields, fingerprint: perception.fingerprint,
    semantic_fingerprint: perception.semantic_fingerprint, image_attached: false, sensitive_categories: perception.sensitive_categories,
    screenshot_blocked_reason: perception.screenshot_blocked_reason, bypass_global_cooldown: false });

  store.ingestMemoryCandidates([{ candidate_id: "candidate_v033_smoke", memory_type: "pattern",
    claim: "Withhold sensitive screenshots before contextual advice", epistemic_status: "verified", source_event_ids: ["v033_smoke"],
    confidence: 0.95, sensitivity: "internal", retention: "until_review", expires_at: null, evidence_reference: null,
    requires_confirmation: false, policy_version: "v0.1.0" }], null, null, project);
  const results = store.searchMemories({ text: "withhold sensitive screenshot", project, kinds: ["pattern"], maximum_sensitivity: "internal", limit: 5 });
  store.recordRetrievalDiagnostic(perception.frame.context_id, project, "withhold sensitive screenshot", results);
  const snapshot = store.snapshot(), durable = JSON.stringify(snapshot), diagnostics = JSON.stringify(snapshot.retrieval_diagnostics);
  const checks = {
    schema: snapshot.recovery.schema_version_applied === "0.3.3",
    correction_revision: snapshot.pending_setup?.revision === 2 && snapshot.pending_setup.proposal.interpreted_profile?.available_hours_per_week.source === "confirmed",
    screenshot_blocked: perception.screenshot === null && perception.screenshot_blocked_reason === "sensitive_content",
    raw_content_absent: !/Client Omega|sk-abcdefghijklmnop|raw-sensitive-frame/.test(durable),
    scoped_retrieval: results.length > 0 && results[0]!.project === project && results[0]!.retrieval_path === "fts_vector",
    private_diagnostic: snapshot.retrieval_diagnostics.length === 1 && !diagnostics.includes("withhold sensitive screenshot") && !diagnostics.includes("Withhold sensitive screenshots before contextual advice"),
  };
  process.stdout.write(`${JSON.stringify({ checks, retrieval: results.map((item) => ({ memory_id: item.memory.memory_id, score: item.score, provenance: item.provenance })) }, null, 2)}\n`);
  if (Object.values(checks).some((value) => !value)) process.exitCode = 1;
} finally { store.close(); await rm(directory, { recursive: true, force: true }); }
