import path from "node:path";
import { createOperatingContracts } from "../../../src/infrastructure/contracts/operating-contracts.js";
import { loadRuntimeConfig } from "../../../src/infrastructure/config/runtime-config.js";
import { CodexOperatingPlanner } from "../../../src/application/planning/codex-planner.js";
import type { DailyPlan } from "../../../src/core/operating-system/types.js";

if (process.platform !== "win32") throw new Error("V0.3.2 live acceptance is Windows-only.");
const root = path.resolve("."), project = path.resolve(process.argv[2] ?? process.env.KOVACS_LIVE_PROJECT ?? root);
const config = loadRuntimeConfig(root), contracts = await createOperatingContracts(config.contractsDirectory), planner = new CodexOperatingPlanner(config, contracts);
console.log("Running two real, read-only, schema-constrained Codex CLI calls. This consumes model usage.");
const setup = await planner.draftSetup({ narrative: "I am validating Kovacs while building it. I can invest about 20 hours each week. My main gap is contextual intervention quality, and in 90 days I want a reliable copilot loop supported by evidence." }, "Become an Elite AI Systems Staff Engineer");
const day: DailyPlan = { schema_version: "0.3.0", day_id: "day_live", ambient_day_id: "ambient_live", project, original_objective: "Validate V0.3.2", objective: "Validate natural-language End Day interpretation", success_criteria: ["Structured proposal is conservative"], status: "active", outcome: null, output_summary: null, validation_summary: null, lesson: null, started_at: new Date().toISOString(), ended_at: null, revision: 1, deterministic_summary: null, checkpoints: [{ checkpoint_id: "cp_live", day_id: "day_live", position: 0, title: "Run live acceptance", evidence_required: "Schema-valid output", competency: "testing_reliability", status: "active", status_reason: null, completed_at: null }] };
const end = await planner.draftEndDay!("I completed the structured Codex calls and saw valid output, but I have not yet manually inspected native Windows OCR.", day, "V0.3.2 live acceptance; no external actions.");
const checks = { calibration_schema: Boolean(setup.proposal.interpreted_profile), bounded_questions: (setup.proposal.clarification_questions?.length ?? 0) <= 2, end_day_schema: end.proposal.schema_version === "0.3.2", conservative_proof: end.proposal.missing_proof.length > 0 };
console.log(JSON.stringify({ checks, latency_ms: { calibration: setup.duration_ms, end_day: end.duration_ms }, prompt_characters: { calibration: setup.prompt_characters, end_day: end.prompt_characters } }, null, 2));
if (Object.values(checks).some((value) => !value)) process.exitCode = 1;
