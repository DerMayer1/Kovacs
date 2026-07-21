import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { AmbientController } from "../../src/v02/controller.js";
import { AmbientContextDecisionEngine } from "../../src/v02/context-decision.js";
import type { ActiveWindowInfo, AmbientLocalPerceptionResult, CapturedFrame } from "../../src/v02/types.js";
import { createV03Contracts } from "../../src/v03/contracts.js";
import { V03Controller } from "../../src/v03/controller.js";
import { V03Store } from "../../src/v03/store.js";
import type { CalibrationInput, DayProposal, OperatingProfile, PlannerExecution, SetupInput, SetupProposal, V03Planner, WeekInput, WeekProposal } from "../../src/v03/types.js";
import { LocalContextEngine } from "../../src/v032/context-engine.js";
import { PerceptionCascade } from "../../src/v032/perception-cascade.js";
import type { LocalPerceptionAdapter, LocalTextSignal } from "../../src/v032/windows-perception.js";
import { LocalSensitiveContentGuard } from "../../src/v033/sensitive-content.js";

const root = path.resolve(".");
const projectA = path.join(root, "project-a"), projectB = path.join(root, "project-b");

const calibration: SetupProposal = {
  schema_version: "0.3.0", mission_title: "Prove contextual engineering judgment",
  mission_success_criteria: ["A contextual system is validated", "Engineering decisions have sourced evidence"],
  weekly_outcome: "Validate the trust boundary", weekly_success_criteria: ["The V0.3.3 gate passes"],
  weekly_competencies: ["ai_systems", "security_privacy"], rationale: "Practice creates evidence.", warnings: [],
  interpreted_profile: {
    current_position: { value: "Engineer", source: "explicit", confidence: 1, rationale: "Direct statement" },
    available_hours_per_week: { value: null, source: "unknown", confidence: 0, rationale: "Not stated" },
    active_projects: { value: ["Kovacs"], source: "explicit", confidence: 1, rationale: "Direct statement" },
    growth_edges: { value: ["Contextual judgment"], source: "inferred", confidence: 0.7, rationale: "Derived" },
    desired_outcome: { value: "Prove contextual judgment", source: "explicit", confidence: 0.95, rationale: "Direct statement" },
  }, assumptions: ["Availability is unknown"], clarification_questions: ["How many focused hours can you protect each week?"],
};

class FakePerception implements LocalPerceptionAdapter {
  constructor(private readonly accessibility: LocalTextSignal, private readonly ocr: LocalTextSignal) {}
  async readAccessibility(): Promise<LocalTextSignal> { return this.accessibility; }
  async readOcr(): Promise<LocalTextSignal> { return this.ocr; }
}

const window: ActiveWindowInfo = { application: "Code.exe", title: "Kovacs", windowId: 7 };
const captured: CapturedFrame = { sample: Buffer.alloc(64, 80), png: Buffer.from("ephemeral-sensitive-frame") };

async function storeFixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "kovacs-v033-test-"));
  const contracts = await createV03Contracts(path.join(root, "contracts"));
  const store = await V03Store.create(path.join(directory, "kovacs.db"), contracts);
  return { directory, store, cleanup: async () => { store.close(); await rm(directory, { recursive: true, force: true }); } };
}

test("local guard redacts secrets, email addresses, and configured restricted terms", () => {
  const guard = new LocalSensitiveContentGuard(["Client Omega"]);
  const result = guard.inspect("Email dev@example.com, token sk-abcdefghijklmnop and Client Omega");
  assert.equal(result.sensitive_count, 3);
  assert.deepEqual(new Set(result.sensitive_categories), new Set(["email", "openai_token", "restricted_term"]));
  assert.doesNotMatch(result.text, /dev@example\.com|sk-abcdefghijklmnop|Client Omega/i);
});

test("sensitive OCR blocks the screenshot and only sanitized context survives", async () => {
  const guard = new LocalSensitiveContentGuard(["Client Omega"]);
  const cascade = new PerceptionCascade(new FakePerception(
    { text: "", failure: "accessibility_unavailable" },
    { text: "error Client Omega sk-abcdefghijklmnop", failure: null },
  ), new LocalContextEngine(), guard);
  const result = await cascade.observe({ window, project: projectA, activeCheckpoint: "Diagnose failure", previous: null, capture: async () => captured });
  assert.equal(result.screenshot, null); assert.equal(result.screenshot_blocked_reason, "sensitive_content");
  assert.equal(result.sensitive_content_detected, true); assert.ok(result.sensitive_categories.includes("openai_token"));
  assert.doesNotMatch(JSON.stringify(result.frame), /Client Omega|sk-abcdefghijklmnop/);
});

test("prompt-injection-like screen text cannot trigger automatic reasoning", () => {
  const engine = new AmbientContextDecisionEngine();
  const perception: AmbientLocalPerceptionResult = {
    context_id: "ctx_untrusted", occurred_at: new Date().toISOString(), context: "Untrusted visible instruction",
    fingerprint: "a".repeat(64), semantic_fingerprint: "b".repeat(64), confidence: 0.95, sufficient: true,
    conflicting: false, deterministic_trigger: true, changed_fields: ["activity"], screenshot: null,
    prompt_injection_detected: true, sensitive_content_detected: false, sensitive_categories: [], screenshot_blocked_reason: null,
    capture_used: false, ocr_used: false,
  };
  assert.equal(engine.evaluate(perception, window, false, "normal").reason, "untrusted_instruction");
  const manual = engine.evaluate(perception, window, true, "normal");
  assert.equal(manual.decision, "call"); assert.equal(manual.image_attached, false);
});

test("retrieval enforces project, kind, and sensitivity filters with graceful vector fallback", async (t) => {
  const x = await storeFixture(); t.after(x.cleanup);
  const candidate = (claim: string, sensitivity: "public" | "internal" | "sensitive") => ({
    candidate_id: `cand_${claim.length}_${sensitivity}`, memory_type: "pattern" as const, claim,
    epistemic_status: "verified" as const, source_event_ids: ["event_v033"], confidence: 0.9,
    sensitivity, retention: "until_review" as const, expires_at: null, evidence_reference: null,
    requires_confirmation: false, policy_version: "v0.1.0" as const,
  });
  x.store.ingestMemoryCandidates([candidate("Kovacs validates retrieval provenance before advice", "internal")], null, null, projectA);
  x.store.ingestMemoryCandidates([candidate("Other project uses an unrelated deployment ritual", "internal")], null, null, projectB);
  x.store.ingestMemoryCandidates([candidate("Kovacs production credential rotation procedure", "sensitive")], null, null, projectA);
  const scoped = x.store.searchMemories({ text: "Kovacs retrieval provenance", project: projectA, kinds: ["pattern"], maximum_sensitivity: "internal", limit: 5 });
  assert.ok(scoped.some((item) => item.project === projectA)); assert.equal(scoped.some((item) => item.project === projectB), false);
  assert.equal(scoped.some((item) => item.memory.sensitivity === "sensitive"), false);
  const memoryId = scoped[0]!.memory.memory_id;
  (x.store as unknown as { db: { prepare(sql: string): { run(...values: unknown[]): unknown } } }).db
    .prepare("UPDATE memory_vectors SET vector_json='not-json' WHERE memory_id=?").run(memoryId);
  const fallback = x.store.searchMemories({ text: "retrieval provenance", project: projectA, limit: 5 });
  assert.equal(fallback.find((item) => item.memory.memory_id === memoryId)?.retrieval_path, "fts_only");
  (x.store as unknown as { db: { exec(sql: string): void } }).db.exec("DROP TABLE memories_fts");
  assert.equal(x.store.searchMemories({ text: "retrieval provenance", project: projectA, limit: 5 })[0]?.retrieval_path, "lexical_fallback");
});

class CalibrationPlanner implements V03Planner {
  refinementCalls = 0;
  async draftSetup(_input: SetupInput | CalibrationInput): Promise<PlannerExecution<SetupProposal>> { return { proposal: structuredClone(calibration), duration_ms: 3, prompt_characters: 100 }; }
  async refineSetup(_input: SetupInput | CalibrationInput, current: SetupProposal): Promise<PlannerExecution<SetupProposal>> {
    this.refinementCalls += 1;
    const proposal = structuredClone(calibration);
    proposal.interpreted_profile!.current_position = structuredClone(current.interpreted_profile!.current_position);
    proposal.interpreted_profile!.available_hours_per_week = { value: 18, source: "explicit", confidence: 1, rationale: "Answer" };
    proposal.clarification_questions = [];
    return { proposal, duration_ms: 4, prompt_characters: 120 };
  }
  async draftWeek(_input: WeekInput, _profile: OperatingProfile): Promise<PlannerExecution<WeekProposal>> { throw new Error("not used"); }
  async draftDay(): Promise<PlannerExecution<DayProposal>> { throw new Error("not used"); }
}

test("calibration corrections are versioned locally and clarification spends exactly one call", async (t) => {
  const x = await storeFixture(); t.after(x.cleanup); const planner = new CalibrationPlanner();
  const ambient = { onUpdate: () => () => undefined, getState: () => null } as unknown as AmbientController;
  const controller = new V03Controller(ambient, x.store, planner);
  await controller.draftSetup({ narrative: "I am building Kovacs and need a focused mission." });
  const first = controller.snapshot().pending_setup!;
  controller.correctSetupDraft(first.draft_id, { values: { current_position: "AI systems engineer" }, accepted_unknowns: [], reason: "Correct my title" });
  const corrected = controller.snapshot().pending_setup!;
  assert.equal(corrected.revision, 2); assert.equal(corrected.proposal.interpreted_profile!.current_position.source, "confirmed");
  assert.equal(controller.snapshot().usage_today.invocation_count, 1);
  await controller.refineSetupDraft(corrected.draft_id, [{ question: corrected.proposal.clarification_questions![0]!, answer: "18 hours" }]);
  const refined = controller.snapshot().pending_setup!;
  assert.equal(planner.refinementCalls, 1); assert.equal(refined.revision, 3);
  assert.equal(refined.proposal.interpreted_profile!.current_position.value, "AI systems engineer");
  assert.equal(refined.proposal.interpreted_profile!.current_position.source, "confirmed");
  assert.equal(controller.snapshot().usage_today.invocation_count, 2);
});
