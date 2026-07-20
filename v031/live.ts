import path from "node:path";
import { createV03Contracts } from "../src/v03/contracts.js";
import { loadV03Config } from "../src/v03/config.js";
import { CodexV03Planner } from "../src/v03/planner.js";
import type { OperatingProfile } from "../src/v03/types.js";

if (process.platform !== "win32") throw new Error("V0.3.1 live acceptance is Windows-only.");
const root = path.resolve("."), project = path.resolve(process.argv[2] ?? process.env.KOVACS_LIVE_PROJECT ?? root);
const config = loadV03Config(root), contracts = await createV03Contracts(config.contractsDirectory), planner = new CodexV03Planner(config, contracts);
console.log("Running two real, read-only, schema-constrained Codex CLI calls. This consumes model usage.");
const setup = await planner.draftSetup({ current_position: "Engineer validating Kovacs", available_hours_per_week: 20, active_projects: "Kovacs", weaknesses: "Contextual intervention quality", desired_outcome: "A reliable contextual copilot operating loop" }, "Become an Elite AI Systems Staff Engineer");
const at = new Date().toISOString();
const profile: OperatingProfile = { schema_version: "0.3.0", main_goal: "Become an Elite AI Systems Staff Engineer", mission: { title: setup.proposal.mission_title, success_criteria: setup.proposal.mission_success_criteria, starts_at: at, target_date: new Date(Date.now() + 90 * 86_400_000).toISOString() }, week: { primary_outcome: setup.proposal.weekly_outcome, success_criteria: setup.proposal.weekly_success_criteria, competencies: setup.proposal.weekly_competencies, starts_at: at }, created_at: at, updated_at: at };
const day = await planner.draftDay(project, "Validate one bounded V0.3.1 hardening slice", profile, "Live acceptance only. No durable user data and no external actions.");
const checks = { setup_schema: setup.proposal.schema_version === "0.3.0", day_schema: day.proposal.schema_version === "0.3.0", bounded_checkpoints: day.proposal.checkpoints.length >= 2 && day.proposal.checkpoints.length <= 6 };
console.log(JSON.stringify({ checks, latency_ms: { setup: setup.duration_ms, day: day.duration_ms }, prompt_characters: { setup: setup.prompt_characters, day: day.prompt_characters } }, null, 2));
if (Object.values(checks).some((value) => !value)) process.exitCode = 1;
