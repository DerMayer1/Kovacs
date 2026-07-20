import { access, mkdtemp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createV03Contracts } from "../src/v03/contracts.js";
import { V03Store } from "../src/v03/store.js";

if (process.platform !== "win32") throw new Error("V0.3.1 smoke is Windows-only.");
const root = path.resolve("."), temporary = await mkdtemp(path.join(os.tmpdir(), "kovacs-v031-smoke-")), project = path.join(temporary, "project");
await mkdir(project); let store: V03Store | null = null;
try {
  const contracts = await createV03Contracts(path.join(root, "contracts"));
  const database = path.join(temporary, "data", "kovacs.db"); store = await V03Store.create(database, contracts);
  store.saveSetupDraft({ current_position: "Engineer", available_hours_per_week: 20, active_projects: "Kovacs", weaknesses: "Scope control", desired_outcome: "Prove contextual judgment" }, { schema_version: "0.3.0", mission_title: "Prove a reliable contextual copilot", mission_success_criteria: ["A validated operating loop", "Recovery and privacy evidence are documented"], weekly_outcome: "Harden V0.3", weekly_success_criteria: ["Release gate passes"], weekly_competencies: ["testing_reliability"], rationale: "Evidence first.", warnings: [] });
  store.confirmSetup(store.snapshot().pending_setup!.draft_id, "Become an Elite AI Systems Staff Engineer");
  store.saveDayDraft(project, "Prove hardening", { schema_version: "0.3.0", proposed_objective: "Prove V0.3.1 hardening", objective_changed: true, success_criteria: ["Smoke passes"], checkpoints: [{ title: "Run smoke", evidence_required: "Passing output", competency: "testing_reliability" }, { title: "Carry remaining work", evidence_required: "Deterministic summary", competency: "execution_ownership" }], rationale: "Bounded proof.", warnings: [] });
  const day = store.startDay(store.snapshot().pending_day!.draft_id, "ambient_v031_smoke");
  const invocation = store.beginInvocation({ day_id: day.day_id, reason: "smoke", urgency: "important", image_attached: false });
  store.finishInvocation(invocation, { duration_ms: 10, prompt_characters: 100, response_characters: 50, cached: false, outcome: "displayed", response_used: true });
  store.completeCheckpoint({ checkpoint_id: day.checkpoints[0]!.checkpoint_id, outcome: "achieved", result: "Smoke executed", validation: "Assertions passed", assistance_level: "A1", evidence_source: "tool_verified" });
  store.addInterventionFeedback("req_v031_smoke", "useful", null);
  const ended = store.endDay({ outcome: "partially_achieved", output_summary: "Hardening smoke complete", validation_summary: "Assertions passed", lesson: "Keep recovery explicit", evidence_source: "tool_verified" });
  const backup = await store.createBackup(path.join(temporary, "backup")); await access(backup.database); await access(backup.export);
  const checks = { schema: store.snapshot().recovery.schema_version_applied === "0.3.1", tool_evidence: store.snapshot().competencies.some((item) => item.evidence_count > 0), deterministic_end: ended.deterministic_summary?.deferred_checkpoints === 1, telemetry: store.snapshot().usage_today.response_characters === 50, feedback: store.snapshot().recent_feedback.length === 1, backup: true, no_window_titles: store.snapshot().retention.persist_window_titles === false };
  console.log(JSON.stringify({ checks, usage: store.snapshot().usage_today, summary: ended.deterministic_summary }, null, 2));
  if (Object.values(checks).some((value) => !value)) process.exitCode = 1;
} finally { store?.close(); await rm(temporary, { recursive: true, force: true }); }
