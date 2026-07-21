import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { createV03Contracts } from "../../src/v03/contracts.js";
import { LocalContextEngine } from "../../src/v032/context-engine.js";
import { cosineSimilarity, embedLocally, vectorSourceHash } from "../../src/v032/memory.js";
import { V03Store } from "../../src/v03/store.js";
import type { EndDayProposal, SetupProposal } from "../../src/v03/types.js";

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
  const contracts = await createV03Contracts(path.join(root, "contracts"));
  const database = path.join(directory, "data", "kovacs.db"), store = await V03Store.create(database, contracts);
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
  x.store.recordContextFrame(frame);
  const durable = JSON.stringify(x.store.snapshot().recent_context);
  assert.doesNotMatch(durable, /Client Omega confidential/);
  assert.equal(frame.text_digest?.length, 64);
  assert.deepEqual(frame.signal_sources, ["active_window", "operating_state", "accessibility", "ocr"]);
});

test("local vectors are deterministic and hybrid retrieval exposes provenance", async (t) => {
  const x = await fixture(); t.after(x.cleanup);
  x.store.confirmSetup(x.store.snapshot().pending_setup!.draft_id, "Become an Elite AI Systems Staff Engineer");
  const first = embedLocally("contextual AI systems"), second = embedLocally("contextual AI systems");
  assert.deepEqual(first, second); assert.ok(cosineSimilarity(first, second) > 0.999); assert.equal(vectorSourceHash("x").length, 64);
  const results = x.store.searchMemories("Kovacs contextual judgment", 5);
  assert.ok(results.length > 0); assert.match(results[0]!.provenance, /^local-hybrid:/);
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

test("V0.3.2 migration is additive and backup excludes raw perception", async (t) => {
  const x = await fixture();
  const sqlite = new DatabaseSync(x.database); const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>; sqlite.close();
  assert.ok(["context_frames", "memory_vectors", "end_day_drafts"].every((name) => tables.some((table) => table.name === name)));
  const backup = await x.store.createBackup(path.join(x.directory, "backup")); const exported = await readFile(backup.export, "utf8");
  assert.match(exported, /"schema_version": "0.3.2"/); assert.doesNotMatch(exported, /ocrText|accessibilityText|"window_title":/);
  await x.cleanup(); t.after(() => Promise.resolve());
});
