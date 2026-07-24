import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { createOperatingContracts } from "../../src/infrastructure/contracts/operating-contracts.js";
import { LocalContextEngine } from "../../src/core/context/context-engine.js";
import { cosineSimilarity, embedLocally, vectorSourceHash } from "../../src/core/memory/retrieval.js";
import { SqliteOperatingStore } from "../../src/infrastructure/persistence/sqlite-operating-store.js";
import type { EndDayProposal, SetupProposal } from "../../src/core/operating-system/types.js";

const root = path.resolve(".");
const calibration: SetupProposal = {
  schema_version: "0.3.0", mission_title: "Prove contextual engineering judgment",
  mission_success_criteria: ["A private context loop is validated", "Engineering decisions have sourced evidence"],
  weekly_outcome: "Validate the context foundation", weekly_success_criteria: ["Release gate passes"],
  weekly_competencies: ["ai_systems", "security_privacy"], rationale: "Practice creates evidence.", warnings: [],
  interpreted_profile: {
    current_position: { value: "Engineer", source: "explicit", confidence: 1, rationale: "Direct statement" },
    available_hours_per_week: { value: null, source: "unknown", confidence: 0, rationale: "Not stated" },
    active_projects: { value: ["Kovacs"], source: "explicit", confidence: 1, rationale: "Direct statement" },
    growth_edges: { value: ["Contextual judgment"], source: "inferred", confidence: 0.7, rationale: "Derived from desired improvement" },
    desired_outcome: { value: "Prove contextual judgment", source: "explicit", confidence: 0.95, rationale: "Direct statement" },
  }, assumptions: ["Weekly availability is unknown"], clarification_questions: ["How many focused hours can you protect each week?"],
};

async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "kovacs-v032-test-"));
  const project = path.join(directory, "project"); await mkdir(project);
  const contracts = await createOperatingContracts(path.join(root, "contracts"));
  const database = path.join(directory, "data", "kovacs.db"), store = await SqliteOperatingStore.create(database, contracts);
  store.saveSetupDraft({ narrative: "I am an engineer building Kovacs to prove contextual judgment." }, calibration);
  return { directory, project, database, store, cleanup: async () => { store.close(); await rm(directory, { recursive: true, force: true }); } };
}

test("natural calibration preserves uncertainty until explicit confirmation", async (t) => {
  const x = await fixture(); t.after(x.cleanup);
  assert.equal(x.store.snapshot().profile, null);
  assert.equal(x.store.snapshot().pending_setup?.proposal.interpreted_profile?.available_hours_per_week.source, "unknown");
  x.store.confirmSetup(x.store.snapshot().pending_setup!.draft_id, "Become an Elite AI Systems Staff Engineer");
  assert.ok(x.store.snapshot().profile);
  assert.equal(x.store.snapshot().memories.some((memory) => memory.claim.includes("Available deliberate-practice time")), false);
});

test("context engine persists a compact frame without raw title or extracted text", async (t) => {
  const x = await fixture(); t.after(x.cleanup);
  const engine = new LocalContextEngine(), secret = "Client Omega confidential";
  const frame = engine.analyze({ application: "Code.exe", windowTitle: `${secret} controller.ts`, project: x.project,
    activeCheckpoint: "Diagnose test", accessibilityText: `failing assertion ${secret}`, ocrText: "Expected 2 received 3", previous: null });
  x.store.recordContextFrame(frame, { kind: "evidence", occurred_at: new Date().toISOString(), context_id: frame.context_id,
    reference_id: "ev_context_test", retention_class: "evidence" });
  const durable = JSON.stringify(x.store.snapshot().recent_context);
  assert.doesNotMatch(durable, /Client Omega confidential/);
  assert.equal(frame.text_digest?.length, 64);
  assert.deepEqual(frame.signal_sources, ["active_window", "operating_state", "accessibility", "ocr"]);
});

test("context lifecycle persists only event-bound frames and prunes compact telemetry", async (t) => {
  const x = await fixture(); t.after(x.cleanup);
  const engine = new LocalContextEngine(), old = "2020-01-01T00:00:00.000Z";
  const base = engine.analyze({ application: "Code.exe", windowTitle: "controller.ts", project: x.project,
    activeCheckpoint: "Validate lifecycle", accessibilityText: "reviewing controller architecture", ocrText: "", previous: null });
  assert.equal(x.store.snapshot().recent_context.length, 0);
  const expiringId = `ctx_${"e".repeat(32)}`, evidenceId = `ctx_${"f".repeat(32)}`;
  x.store.recordContextFrame({ ...base, context_id: expiringId, occurred_at: old }, {
    kind: "intervention", occurred_at: old, context_id: expiringId, reference_id: "req_old", retention_class: "event",
  });
  x.store.recordContextFrame({ ...base, context_id: evidenceId, occurred_at: old }, {
    kind: "evidence", occurred_at: old, context_id: evidenceId, reference_id: "ev_keep", retention_class: "evidence",
  });
  x.store.recordContextDecision({ occurred_at: old, context_id: "ctx_expiring", application: "Code.exe", confidence: 0.9,
    perception_path: "uia", decision: "silence", reason: "same_context_cooldown", changed_fields: [],
    fingerprint: "a".repeat(64), semantic_fingerprint: "b".repeat(64), image_attached: false,
    sensitive_categories: [], screenshot_blocked_reason: null, bypass_global_cooldown: false });
  const policy = x.store.retentionPolicy();
  assert.equal(policy.context_retention_days, 14); assert.equal(policy.telemetry_retention_days, 30);
  x.store.applyRetention();
  assert.deepEqual(x.store.listContextFrames().map((frame) => frame.context_id), [evidenceId]);
  assert.equal(x.store.listContextDecisions().length, 0);
});

test("local vectors are deterministic and hybrid retrieval exposes provenance", async (t) => {
  const x = await fixture(); t.after(x.cleanup);
  x.store.confirmSetup(x.store.snapshot().pending_setup!.draft_id, "Become an Elite AI Systems Staff Engineer");
  const first = embedLocally("contextual AI systems"), second = embedLocally("contextual AI systems");
  assert.deepEqual(first, second); assert.ok(cosineSimilarity(first, second) > 0.999); assert.equal(vectorSourceHash("x").length, 64);
  const results = x.store.searchMemories("Kovacs contextual judgment", 5);
  assert.ok(results.length > 0); assert.equal(results[0]!.retrieval_path, "fts_vector");
  assert.match(results[0]!.provenance, /^local-fts_vector:/);
  const target = results[0]!.memory.memory_id; x.store.deleteMemory(target);
  assert.equal(x.store.searchMemories("Kovacs contextual judgment", 20).some((item) => item.memory.memory_id === target), false);
});

test("End Day interpretation remains a draft until confirmed by the close path", async (t) => {
  const x = await fixture(); t.after(x.cleanup); x.store.confirmSetup(x.store.snapshot().pending_setup!.draft_id, "Become an Elite AI Systems Staff Engineer");
  x.store.saveDayDraft(x.project, "Validate End Day", { schema_version: "0.3.0", proposed_objective: "Validate End Day confirmation", objective_changed: false, success_criteria: ["Draft remains reversible"], checkpoints: [{ title: "Draft debrief", evidence_required: "A pending proposal", competency: "execution_ownership" }, { title: "Confirm debrief", evidence_required: "Closed day", competency: "execution_ownership" }], rationale: "Separate interpretation from fact.", warnings: [] });
  const day = x.store.startDay(x.store.snapshot().pending_day!.draft_id, "ambient_v032_test");
  const proposal: EndDayProposal = { schema_version: "0.3.2", narrative_summary: "A partial result was produced.", outcome: "partially_achieved", output_summary: "End Day proposal implemented", validation_summary: "Focused assertions pending", evidence_source: "self_reported", lesson: "Interpretation is not confirmation", missing_proof: ["Focused test output"], carry_forward: ["Run focused tests"], assumptions: [] };
  const draft = x.store.saveEndDayDraft(day.day_id, "I implemented it but have not run the focused test.", proposal);
  assert.equal(x.store.getActiveDay()?.day_id, day.day_id); assert.equal(x.store.snapshot().pending_end_day?.draft_id, draft.draft_id);
  x.store.rejectEndDayDraft(draft.draft_id, "Need to add proof"); assert.equal(x.store.getActiveDay()?.day_id, day.day_id);
  x.store.saveEndDayDraft(day.day_id, "Now focused tests passed.", { ...proposal, validation_summary: "Focused tests passed", evidence_source: "tool_verified", missing_proof: [] });
  x.store.endDay({ ...proposal, validation_summary: "Focused tests passed", evidence_source: "tool_verified" });
  assert.equal(x.store.getActiveDay(), null); assert.equal(x.store.snapshot().pending_end_day, null);
});

test("V0.3.3 migration remains additive and backup excludes raw perception", async (t) => {
  const x = await fixture();
  const sqlite = new DatabaseSync(x.database); const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>; sqlite.close();
  assert.ok(["context_frames", "context_events", "context_decisions", "memory_vectors", "end_day_drafts"].every((name) => tables.some((table) => table.name === name)));
  const backup = await x.store.createBackup(path.join(x.directory, "backup")); const exported = await readFile(backup.export, "utf8");
  assert.match(exported, /"schema_version": "0.3.3"/); assert.doesNotMatch(exported, /ocrText|accessibilityText|"window_title":/);
  await x.cleanup(); t.after(() => Promise.resolve());
});
