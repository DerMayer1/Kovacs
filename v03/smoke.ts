import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createAmbientContracts } from "../src/v02/contracts.js";
import { defaultAmbientSettings } from "../src/v02/config.js";
import { AmbientController } from "../src/v02/controller.js";
import { AmbientStateStore } from "../src/v02/state-store.js";
import { createV03Contracts } from "../src/v03/contracts.js";
import { V03Controller } from "../src/v03/controller.js";
import { V03Store } from "../src/v03/store.js";
import type { V03Planner } from "../src/v03/types.js";
import type { KovacsService } from "../src/v01/service.js";
import type { ProfileResponse } from "../src/v01/types.js";

if (process.platform !== "win32") throw new Error("V0.3 smoke is Windows-only.");
const root = path.resolve("."), temporary = await mkdtemp(path.join(os.tmpdir(), "kovacs-v03-smoke-")), project = path.join(temporary, "project");
await mkdir(project); await writeFile(path.join(project, "sentinel.txt"), "unchanged", "utf8");
const planner: V03Planner = {
  draftSetup: async () => ({ duration_ms: 1, prompt_characters: 400, proposal: { schema_version: "0.3.0", mission_title: "Ship one validated local-first AI engineering system", mission_success_criteria: ["Working artifact", "Reliability proof"], weekly_outcome: "Complete the first verified implementation slice", weekly_success_criteria: ["Tests pass"], weekly_competencies: ["architecture"], rationale: "Practice creates evidence.", warnings: [] } }),
  draftWeek: async () => ({ duration_ms: 1, prompt_characters: 300, proposal: { schema_version: "0.3.0", primary_outcome: "Validate the next bounded system slice", success_criteria: ["Release gate passes"], competencies: ["testing_reliability"], rationale: "Evidence first.", warnings: [] } }),
  draftDay: async () => ({ duration_ms: 1, prompt_characters: 350, proposal: { schema_version: "0.3.0", proposed_objective: "Prove the complete V0.3 lifecycle", objective_changed: false, success_criteria: ["Lifecycle checks pass"], checkpoints: [{ title: "Exercise lifecycle", evidence_required: "Passing smoke output", competency: "execution_ownership" }, { title: "Verify privacy", evidence_required: "No raw frame in durable storage", competency: "security_privacy" }], rationale: "One bounded proof.", warnings: [] } }),
};
let calls = 0;
const service = { start: async (p: string, task: string) => ({ schema_version: "0.1.0", session_id: "ses_smoke_v03", project: path.resolve(p), task, mode: "training", status: "active", started_at: new Date().toISOString(), ended_at: null, events: [] }), intervene: async (_session: string, profile: "coach" | "debrief") => { calls += 1; const response: ProfileResponse = { schema_version: "0.1.0", request_id: `req_smoke_${calls}`, profile, recommendation: "display", assessment: "Evidence supports a bounded intervention.", intervention: { type: profile === "debrief" ? "debrief" : "hint", message: "Validate the active checkpoint.", assistance_level: "A2", contains_complete_solution: false }, reason: "Evidence first.", observed_context: ["Authorized window"], checkpoint: "Report validation.", memory_candidates: [], external_action_requests: [] }; return { response, cached: false, redaction_count: 0, context_truncated: false, gateway_duration_ms: 1, prompt_characters: 500 }; } };
let store: V03Store | null = null;
try {
  const [ambientContracts, v03Contracts] = await Promise.all([createAmbientContracts(path.join(root, "contracts")), createV03Contracts(path.join(root, "contracts"))]);
  store = await V03Store.create(path.join(temporary, "data", "kovacs.db"), v03Contracts);
  let operating: V03Controller;
  const ambient = new AmbientController(service as unknown as KovacsService, new AmbientStateStore(path.join(temporary, "ambient"), ambientContracts), { ...defaultAmbientSettings(), automatic_intervention_interval_ms: 30_000 }, { getActiveWindow: async () => ({ application: "Code.exe", title: "V0.3 smoke", windowId: 1 }) }, { capture: async () => ({ sample: Buffer.alloc(64, 220), png: Buffer.from("v03-smoke-raw-frame") }) }, { operatingContext: () => operating.contextSummary(), onReasoningComplete: (telemetry) => operating.recordAmbientInvocation(telemetry) });
  operating = new V03Controller(ambient, store, planner); await operating.initialize();
  await operating.draftSetup({ current_position: "Engineer", available_hours_per_week: 20, active_projects: "Kovacs", weaknesses: "Scope control", desired_outcome: "Prove staff-level engineering judgment" });
  operating.confirmSetup(operating.snapshot().pending_setup!.draft_id);
  await operating.draftDay(project, "Prove the lifecycle"); await operating.confirmDay(operating.snapshot().pending_day!.draft_id); await ambient.tick();
  const checkpoint = operating.snapshot().active_day!.checkpoints[0]!;
  operating.completeCheckpoint({ checkpoint_id: checkpoint.checkpoint_id, outcome: "achieved", result: "Lifecycle exercised", validation: "Smoke assertions passed", assistance_level: "A1" });
  await operating.endDay({ outcome: "achieved", output_summary: "V0.3 lifecycle completed", validation_summary: "Smoke assertions passed", lesson: "Keep evidence and observation separate." });
  const database = await readFile(path.join(temporary, "data", "kovacs.db"));
  const checks = {
    profile_confirmed: Boolean(operating.snapshot().profile), observation_ended: ambient.getState()?.status === "ended",
    checkpoint_evidenced: operating.snapshot().competencies.some((item) => item.evidence_count > 0),
    calls_attributed: operating.snapshot().usage_today.invocation_count >= 4,
    no_raw_sqlite: !database.includes(Buffer.from("v03-smoke-raw-frame")), target_unchanged: await readFile(path.join(project, "sentinel.txt"), "utf8") === "unchanged",
  };
  console.log(JSON.stringify({ checks, usage: operating.snapshot().usage_today }, null, 2));
  if (Object.values(checks).some((value) => !value)) process.exitCode = 1;
} finally { store?.close(); await rm(temporary, { recursive: true, force: true }); }
