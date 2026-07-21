import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createAmbientContracts } from "../../src/v02/contracts.js";
import { defaultAmbientSettings } from "../../src/v02/config.js";
import { AmbientController } from "../../src/v02/controller.js";
import { AmbientStateStore } from "../../src/v02/state-store.js";
import { createV03Contracts } from "../../src/v03/contracts.js";
import { V03Controller } from "../../src/v03/controller.js";
import { V03Store } from "../../src/v03/store.js";
import type { CalibrationInput, DayProposal, OperatingProfile, PlannerExecution, SetupInput, SetupProposal, V03Planner, WeekInput, WeekProposal } from "../../src/v03/types.js";
import type { Profile, ProfileResponse, SessionRecord } from "../../src/v01/types.js";
import type { KovacsService } from "../../src/v01/service.js";

const root = path.resolve(".");
const setupProposal: SetupProposal = {
  schema_version: "0.3.0", mission_title: "Ship and validate one reliable local-first AI engineering system",
  mission_success_criteria: ["A working system is shipped", "Reliability evidence is documented"],
  weekly_outcome: "Complete the first bounded architecture and implementation slice",
  weekly_success_criteria: ["Contracts and tests pass"], weekly_competencies: ["architecture", "testing_reliability"],
  rationale: "The mission creates practical evidence instead of activity metrics.", warnings: [],
};
const weekProposal: WeekProposal = {
  schema_version: "0.3.0", primary_outcome: "Prove the local memory and intervention boundary",
  success_criteria: ["The release gate passes"], competencies: ["security_privacy", "execution_ownership"],
  rationale: "This is the next highest-leverage slice.", warnings: [],
};
const dayProposal: DayProposal = {
  schema_version: "0.3.0", proposed_objective: "Implement and validate the V0.3 evidence loop", objective_changed: true,
  success_criteria: ["The evidence loop passes automated tests"],
  checkpoints: [
    { title: "Implement the evidence store", evidence_required: "A local SQLite record validated by tests", competency: "software_design_implementation" },
    { title: "Run the release gate", evidence_required: "Passing typecheck, tests, and build", competency: "testing_reliability" },
  ], rationale: "The original objective was made measurable.", warnings: [],
};

class FakePlanner implements V03Planner {
  calls: string[] = [];
  async draftSetup(_input: SetupInput | CalibrationInput): Promise<PlannerExecution<SetupProposal>> { this.calls.push("setup"); return { proposal: setupProposal, duration_ms: 11, prompt_characters: 900 }; }
  async draftWeek(_input: WeekInput, _profile: OperatingProfile): Promise<PlannerExecution<WeekProposal>> { this.calls.push("week"); return { proposal: weekProposal, duration_ms: 12, prompt_characters: 700 }; }
  async draftDay(): Promise<PlannerExecution<DayProposal>> { this.calls.push("day"); return { proposal: dayProposal, duration_ms: 13, prompt_characters: 800 }; }
}

class FakeService {
  calls: Profile[] = [];
  async start(project: string, task: string): Promise<SessionRecord> {
    return { schema_version: "0.1.0", session_id: "ses_v03_test", project: path.resolve(project), task, mode: "training", status: "active", started_at: new Date().toISOString(), ended_at: null, events: [] };
  }
  async intervene(_sessionId: string, profile: Profile, input: { imagePaths?: string[] }): Promise<{ response: ProfileResponse; cached: false; redaction_count: 0; context_truncated: false; gateway_duration_ms: number; prompt_characters: number }> {
    for (const imagePath of input.imagePaths ?? []) await access(imagePath);
    this.calls.push(profile);
    return { response: {
      schema_version: "0.1.0", request_id: `req_${profile}_${this.calls.length}`, profile, recommendation: "display",
      assessment: "Authorized evidence supports one bounded next action.",
      intervention: { type: profile === "debrief" ? "debrief" : "hint", message: "Validate the current checkpoint before expanding scope.", assistance_level: "A2", contains_complete_solution: false },
      reason: "Evidence before action.", observed_context: ["Authorized window"], checkpoint: "Report the validation result.",
      memory_candidates: profile === "coach" ? [{ candidate_id: "mem_candidate", memory_type: "pattern", claim: "The learner may expand scope before validation.", epistemic_status: "inferred", source_event_ids: ["amb_fixture"], confidence: 0.6, sensitivity: "internal", retention: "until_review", expires_at: null, evidence_reference: null, requires_confirmation: true, policy_version: "v0.1.0" }] : [], external_action_requests: [],
    }, cached: false, redaction_count: 0, context_truncated: false, gateway_duration_ms: 17, prompt_characters: 1200 };
  }
}

async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "kovacs-v03-test-"));
  const project = path.join(directory, "project"); await mkdir(project); await writeFile(path.join(project, "sentinel.txt"), "unchanged", "utf8");
  const [ambientContracts, v03Contracts] = await Promise.all([createAmbientContracts(path.join(root, "contracts")), createV03Contracts(path.join(root, "contracts"))]);
  const store = await V03Store.create(path.join(directory, "data", "kovacs.db"), v03Contracts);
  const service = new FakeService(), planner = new FakePlanner();
  let operating: V03Controller;
  const ambient = new AmbientController(service as unknown as KovacsService, new AmbientStateStore(path.join(directory, "ambient"), ambientContracts), { ...defaultAmbientSettings(), automatic_intervention_interval_ms: 30_000 }, { getActiveWindow: async () => ({ application: "Code.exe", title: "V0.3 test", windowId: 1 }) }, { capture: async () => ({ sample: Buffer.alloc(64, 180), png: Buffer.from("ephemeral-v03-frame") }) }, { operatingContext: () => operating.contextSummary(), onReasoningComplete: (telemetry) => operating.recordAmbientInvocation(telemetry) });
  operating = new V03Controller(ambient, store, planner); await operating.initialize();
  return { directory, project, store, service, planner, ambient, operating, cleanup: async () => { store.close(); await rm(directory, { recursive: true, force: true }); } };
}

const setupInput: SetupInput = { current_position: "Senior engineer building AI systems", available_hours_per_week: 20, active_projects: "Kovacs", weaknesses: "Architecture communication and scope control", desired_outcome: "Demonstrate staff-level judgment through validated systems" };

test("setup and weekly hierarchy require explicit confirmation", async (t) => {
  const x = await fixture(); t.after(x.cleanup);
  await x.operating.draftSetup(setupInput); assert.equal(x.operating.snapshot().profile, null);
  const setup = x.operating.snapshot().pending_setup; assert.ok(setup); x.operating.confirmSetup(setup!.draft_id);
  assert.equal(x.operating.snapshot().profile?.mission.title, setupProposal.mission_title);
  assert.equal(x.operating.snapshot().competencies.every((item) => item.level === "unverified"), true);
  await x.operating.draftWeek({ priorities: "Privacy and evidence", constraints: "One week" });
  assert.equal(x.operating.snapshot().profile?.week.primary_outcome, setupProposal.weekly_outcome);
  x.operating.confirmWeek(x.operating.snapshot().pending_week!.draft_id);
  assert.equal(x.operating.snapshot().profile?.week.primary_outcome, weekProposal.primary_outcome);
});

test("daily planning spends one reasoning call and starts only after approval", async (t) => {
  const x = await fixture(); t.after(x.cleanup); await x.operating.draftSetup(setupInput); x.operating.confirmSetup(x.operating.snapshot().pending_setup!.draft_id);
  await x.operating.draftDay(x.project, "Work on V0.3");
  assert.equal(x.ambient.getState(), null); assert.deepEqual(x.planner.calls, ["setup", "day"]);
  await x.operating.confirmDay(x.operating.snapshot().pending_day!.draft_id);
  assert.equal(x.ambient.getState()?.status, "observing"); assert.equal(x.operating.snapshot().active_day?.objective, dayProposal.proposed_objective);
});

test("checkpoint evidence advances competence without activity scoring", async (t) => {
  const x = await fixture(); t.after(x.cleanup); await x.operating.draftSetup(setupInput); x.operating.confirmSetup(x.operating.snapshot().pending_setup!.draft_id); await x.operating.draftDay(x.project, "Work on V0.3"); await x.operating.confirmDay(x.operating.snapshot().pending_day!.draft_id);
  const checkpoint = x.operating.snapshot().active_day!.checkpoints[0]!;
  x.operating.completeCheckpoint({ checkpoint_id: checkpoint.checkpoint_id, outcome: "achieved", result: "SQLite evidence store implemented", validation: "Focused tests passed", assistance_level: "A1" });
  const competency = x.operating.snapshot().competencies.find((item) => item.competency === checkpoint.competency)!;
  assert.equal(competency.level, "emerging"); assert.equal(competency.evidence_count, 1);
  assert.equal(x.operating.snapshot().active_day!.checkpoints[1]!.status, "active");
});

test("ambient reasoning remains ephemeral and inferred memory waits for review", async (t) => {
  const x = await fixture(); t.after(x.cleanup); await x.operating.draftSetup(setupInput); x.operating.confirmSetup(x.operating.snapshot().pending_setup!.draft_id); await x.operating.draftDay(x.project, "Work on V0.3"); await x.operating.confirmDay(x.operating.snapshot().pending_day!.draft_id);
  await x.ambient.tick();
  assert.equal(x.service.calls.includes("coach"), true);
  assert.equal(x.operating.snapshot().memories.some((memory) => memory.kind === "pattern" && memory.status === "pending_confirmation"), true);
  const database = await readFile(path.join(x.directory, "data", "kovacs.db")); assert.equal(database.includes(Buffer.from("ephemeral-v03-frame")), false);
  assert.equal(await readFile(path.join(x.project, "sentinel.txt"), "utf8"), "unchanged");
});

test("memory is locally inspectable, confirmable, pinnable, and deletable", async (t) => {
  const x = await fixture(); t.after(x.cleanup); await x.operating.draftSetup(setupInput); x.operating.confirmSetup(x.operating.snapshot().pending_setup!.draft_id);
  const memory = x.operating.snapshot().memories.find((item) => item.kind === "context")!;
  x.operating.setMemoryPinned(memory.memory_id, true); assert.equal(x.operating.snapshot().memories.find((item) => item.memory_id === memory.memory_id)?.pinned, true);
  x.operating.deleteMemory(memory.memory_id); assert.equal(x.operating.snapshot().memories.some((item) => item.memory_id === memory.memory_id), false);
});

test("End Day is explicit, records outcome, and stops observation", async (t) => {
  const x = await fixture(); t.after(x.cleanup); await x.operating.draftSetup(setupInput); x.operating.confirmSetup(x.operating.snapshot().pending_setup!.draft_id); await x.operating.draftDay(x.project, "Work on V0.3"); await x.operating.confirmDay(x.operating.snapshot().pending_day!.draft_id);
  await x.operating.endDay({ outcome: "achieved", output_summary: "Implemented the V0.3 operating loop", validation_summary: "Typecheck and focused tests passed", lesson: "Evidence must be separated from observation." });
  assert.equal(x.operating.snapshot().active_day, null); assert.equal(x.ambient.getState()?.status, "ended"); assert.equal(x.service.calls.at(-1), "debrief");
  assert.equal(x.operating.snapshot().memories.some((memory) => memory.kind === "lesson"), true);
});

test("usage telemetry exposes invocation count, context characters, latency, and image use", async (t) => {
  const x = await fixture(); t.after(x.cleanup); await x.operating.draftSetup(setupInput); x.operating.confirmSetup(x.operating.snapshot().pending_setup!.draft_id); await x.operating.draftDay(x.project, "Work on V0.3"); await x.operating.confirmDay(x.operating.snapshot().pending_day!.draft_id); await x.ambient.tick();
  const usage = x.operating.snapshot().usage_today;
  assert.equal(usage.invocation_count, 3); assert.equal(usage.prompt_characters, 900 + 800 + 1200); assert.equal(usage.image_invocations, 1); assert.ok(usage.total_latency_ms > 0);
});

test("SQLite state survives restart while observation recovery remains paused", async (t) => {
  const x = await fixture(); t.after(async () => { await rm(x.directory, { recursive: true, force: true }); });
  await x.operating.draftSetup(setupInput); x.operating.confirmSetup(x.operating.snapshot().pending_setup!.draft_id); const databasePath = path.join(x.directory, "data", "kovacs.db"); x.store.close();
  const contracts = await createV03Contracts(path.join(root, "contracts")); const reopened = await V03Store.create(databasePath, contracts);
  assert.equal(reopened.getProfile()?.mission.title, setupProposal.mission_title); reopened.close();
});
