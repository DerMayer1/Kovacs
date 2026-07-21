import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { createV03Contracts } from "../../src/v03/contracts.js";
import { V03Store } from "../../src/v03/store.js";
import { createAmbientContracts } from "../../src/v02/contracts.js";
import { AmbientStateStore } from "../../src/v02/state-store.js";
import { normalizeCodexOutputSchema } from "../../src/v01/codex-exec.js";
import type { DayProposal, SetupInput, SetupProposal } from "../../src/v03/types.js";

const root = path.resolve(".");
const setupInput: SetupInput = { current_position: "Engineer", available_hours_per_week: 20, active_projects: "Kovacs", weaknesses: "Scope control", desired_outcome: "Demonstrate contextual judgment" };
const setupProposal: SetupProposal = {
  schema_version: "0.3.0", mission_title: "Prove one contextual engineering system", mission_success_criteria: ["A verified artifact exists", "Recovery and privacy evidence are documented"],
  weekly_outcome: "Harden the operating loop", weekly_success_criteria: ["Release gate passes"], weekly_competencies: ["testing_reliability"],
  rationale: "Evidence before expansion.", warnings: [],
};
const dayProposal: DayProposal = {
  schema_version: "0.3.0", proposed_objective: "Validate V0.3.1 recovery", objective_changed: false,
  success_criteria: ["Recovery tests pass"], checkpoints: [
    { title: "Prove recovery", evidence_required: "A passing focused test", competency: "testing_reliability" },
    { title: "Document result", evidence_required: "A reviewable artifact", competency: "technical_communication" },
  ], rationale: "The slice is bounded.", warnings: [],
};

test("Codex output schemas infer explicit primitive types and omit unsupported uniqueness", () => {
  const source = {
    type: "object",
    properties: {
      schema_version: { const: "0.3.0" },
      competency: { enum: ["testing_reliability", "security_privacy"] },
      criteria: { type: "array", uniqueItems: true, items: { type: "string" } },
    },
    required: ["schema_version", "competency", "criteria"],
    additionalProperties: false,
  };
  const encoded = JSON.stringify(normalizeCodexOutputSchema(source));
  assert.match(encoded, /"schema_version":\{"const":"0\.3\.0","type":"string"\}/);
  assert.match(encoded, /"competency":\{"enum":\["testing_reliability","security_privacy"\],"type":"string"\}/);
  assert.doesNotMatch(encoded, /uniqueItems/);
  assert.equal(source.properties.criteria.uniqueItems, true);
});

async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "kovacs-v031-test-"));
  const project = path.join(directory, "project"); await mkdir(project);
  const contracts = await createV03Contracts(path.join(root, "contracts"));
  const database = path.join(directory, "data", "kovacs.db");
  const store = await V03Store.create(database, contracts);
  store.saveSetupDraft(setupInput, setupProposal); store.confirmSetup(store.snapshot().pending_setup!.draft_id, "Become an Elite AI Systems Staff Engineer");
  return { directory, project, database, contracts, store, cleanup: async () => { store.close(); await rm(directory, { recursive: true, force: true }); } };
}

function startDay(store: V03Store, project: string) {
  store.saveDayDraft(project, "Test recovery", dayProposal);
  return store.startDay(store.snapshot().pending_day!.draft_id, `ambient_${Date.now()}`);
}

test("unfinished work and interrupted invocations recover without implicit observation", async (t) => {
  const x = await fixture();
  const day = startDay(x.store, x.project);
  x.store.beginInvocation({ day_id: day.day_id, reason: "live_recovery_test", urgency: "important", image_attached: false });
  x.store.close();
  const reopened = await V03Store.create(x.database, x.contracts);
  t.after(async () => { reopened.close(); await rm(x.directory, { recursive: true, force: true }); });
  assert.equal(reopened.snapshot().recovery.resumed_day_id, day.day_id);
  assert.equal(reopened.snapshot().recovery.interrupted_invocations, 1);
  assert.equal(reopened.snapshot().recovery.observation_requires_manual_resume, true);
});

test("a V0.3.0 database receives additive migrations through V0.3.2", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "kovacs-v030-migration-"));
  const database = path.join(directory, "kovacs.db"), legacy = new DatabaseSync(database);
  legacy.exec(`
    CREATE TABLE day_plans (day_id TEXT PRIMARY KEY, ambient_day_id TEXT NOT NULL UNIQUE, project TEXT NOT NULL, original_objective TEXT NOT NULL, objective TEXT NOT NULL, criteria_json TEXT NOT NULL, status TEXT NOT NULL, outcome TEXT, output_summary TEXT, validation_summary TEXT, lesson TEXT, started_at TEXT NOT NULL, ended_at TEXT);
    CREATE TABLE checkpoints (checkpoint_id TEXT PRIMARY KEY, day_id TEXT NOT NULL, position INTEGER NOT NULL, title TEXT NOT NULL, evidence_required TEXT NOT NULL, competency TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('pending','active','completed','skipped')), completed_at TEXT);
    CREATE TABLE evidence (evidence_id TEXT PRIMARY KEY, day_id TEXT NOT NULL, checkpoint_id TEXT, project TEXT NOT NULL, competency TEXT NOT NULL, source TEXT NOT NULL, assistance_level TEXT NOT NULL, outcome TEXT NOT NULL, confidence REAL NOT NULL, summary TEXT NOT NULL, validation TEXT, source_event_id TEXT, created_at TEXT NOT NULL);
    CREATE TABLE invocations (invocation_id TEXT PRIMARY KEY, day_id TEXT, reason TEXT NOT NULL, urgency TEXT NOT NULL, duration_ms INTEGER NOT NULL, prompt_characters INTEGER NOT NULL, image_attached INTEGER NOT NULL, cached INTEGER NOT NULL, outcome TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE v03_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL); INSERT INTO v03_meta VALUES ('schema_version','0.3.0');
  `); legacy.close();
  const contracts = await createV03Contracts(path.join(root, "contracts")), migrated = await V03Store.create(database, contracts);
  t.after(async () => { migrated.close(); await rm(directory, { recursive: true, force: true }); });
  assert.equal(migrated.snapshot().recovery.schema_version_applied, "0.3.2");
  assert.equal(migrated.snapshot().usage_today.response_characters, 0);
  assert.equal(migrated.snapshot().retention.persist_window_titles, false);
});

test("self reports are not promoted to tool-verified evidence", async (t) => {
  const x = await fixture(); t.after(x.cleanup); const day = startDay(x.store, x.project);
  const evidence = x.store.completeCheckpoint({ checkpoint_id: day.checkpoints[0]!.checkpoint_id, outcome: "achieved", result: "Recovery implemented", validation: "I ran the test", assistance_level: "A1" });
  assert.equal(evidence.source, "self_reported");
  assert.ok(evidence.confidence < 0.9);
});

test("checkpoint and objective changes preserve explicit operating history", async (t) => {
  const x = await fixture(); t.after(x.cleanup); const day = startDay(x.store, x.project);
  x.store.reviseActiveObjective("Validate recovery and privacy", "Privacy is part of the release gate");
  x.store.transitionCheckpoint({ checkpoint_id: day.checkpoints[0]!.checkpoint_id, status: "blocked", reason: "Waiting for a reproducible host signal" });
  const active = x.store.getActiveDay()!;
  assert.equal(active.revision, 3); assert.equal(active.objective, "Validate recovery and privacy");
  assert.equal(active.checkpoints[0]!.status, "blocked"); assert.equal(active.checkpoints[1]!.status, "active");
});

test("partial End Day creates deterministic carry-forward facts", async (t) => {
  const x = await fixture(); t.after(x.cleanup); const day = startDay(x.store, x.project);
  x.store.completeCheckpoint({ checkpoint_id: day.checkpoints[0]!.checkpoint_id, outcome: "achieved", result: "Recovery proven", validation: "npm test passed", assistance_level: "A1", evidence_source: "tool_verified" });
  const ended = x.store.endDay({ outcome: "partially_achieved", output_summary: "Recovery is implemented", validation_summary: "Focused tests passed", lesson: "Recovery must stay paused", evidence_source: "tool_verified" });
  assert.equal(ended.deterministic_summary?.completed_checkpoints, 1);
  assert.equal(ended.deterministic_summary?.deferred_checkpoints, 1);
  assert.deepEqual(ended.deterministic_summary?.carry_forward, ["Document result"]);
});

test("feedback, scoped memory deletion, retention, backup, and export remain local", async (t) => {
  const x = await fixture(); t.after(x.cleanup); const day = startDay(x.store, x.project);
  x.store.ingestMemoryCandidates([{ candidate_id: "mem_scope", memory_type: "pattern", claim: "A scoped temporary pattern", epistemic_status: "inferred", source_event_ids: ["event_scope"], confidence: 0.6, sensitivity: "internal", retention: "until_review", expires_at: null, evidence_reference: null, requires_confirmation: true, policy_version: "v0.1.0" }], day.day_id, "ses_scope");
  assert.equal(x.store.deleteMemoriesByDay(day.day_id), 1);
  x.store.addInterventionFeedback("req_feedback", "wrong_context", "The active checkpoint had changed");
  assert.equal(x.store.snapshot().recent_feedback[0]?.kind, "wrong_context");
  assert.equal(x.store.setRetentionPolicy(null, 14).sensitive_memory_retention_days, 14);
  const backup = await x.store.createBackup(path.join(x.directory, "backup")); await access(backup.database); await access(backup.export);
  const exported = await readFile(backup.export, "utf8"); assert.match(exported, /"schema_version": "0.3.2"/); assert.doesNotMatch(exported, /"window_title":/);
});

test("drafts can be revised or rejected without becoming active", async (t) => {
  const x = await fixture(); t.after(x.cleanup);
  const draft = x.store.saveDayDraft(x.project, "Test", dayProposal);
  x.store.reviseDayDraft(draft.draft_id, { ...dayProposal, proposed_objective: "Test recovery without scope drift", objective_changed: true }, "Make success measurable");
  assert.equal(x.store.snapshot().pending_day?.proposal.proposed_objective, "Test recovery without scope drift");
  x.store.rejectDraft(draft.draft_id, "Not the highest-value work today");
  assert.equal(x.store.snapshot().pending_day, null); assert.equal(x.store.getActiveDay(), null);
});

test("legacy ambient window titles are scrubbed during recovery", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "kovacs-v031-privacy-")); t.after(() => rm(directory, { recursive: true, force: true }));
  const contracts = await createAmbientContracts(path.join(root, "contracts")); const state = new AmbientStateStore(directory, contracts);
  await state.saveState({ schema_version: "0.2.0", day_id: `day_${"a".repeat(32)}`, status: "paused", main_goal: "Goal", objective: "Objective", project: root, session_id: `ses_${"b".repeat(32)}`, started_at: new Date().toISOString(), ended_at: null, last_capture_at: null, last_intervention_at: null, events: [{ event_id: `amb_${"c".repeat(32)}`, occurred_at: new Date().toISOString(), type: "window_authorized", urgency: "normal", application: "Code.exe", window_title: "Secret client document", objective: "Objective", summary: "Authorized active window changed.", frame_attached: false, intervention_request_id: null }] });
  const recovered = await state.loadState(); assert.equal(recovered?.events[0]?.window_title, null);
  assert.doesNotMatch(await readFile(path.join(directory, "current-day.json"), "utf8"), /Secret client document/);
});
