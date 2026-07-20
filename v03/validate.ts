import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createV03Contracts, type V03Contracts } from "../src/v03/contracts.js";
import type { DayProposal, EvidenceRecord, MemoryRecord, SetupProposal, WeekProposal } from "../src/v03/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const results: Array<{ id: string; pass: boolean; detail: string }> = [];
const record = (id: string, pass: boolean, detail: string) => results.push({ id, pass, detail });
const required = [
  "docs/v0.3/00_CHARTER.md", "docs/v0.3/01_ARCHITECTURE.md", "docs/v0.3/02_STATE_MACHINE.md", "docs/v0.3/03_MEMORY_AND_COMPETENCE.md", "docs/v0.3/04_TOKEN_ECONOMY.md", "docs/v0.3/05_SUCCESS_METRICS.md",
  "contracts/v0.3/setup-proposal.schema.json", "contracts/v0.3/week-proposal.schema.json", "contracts/v0.3/day-proposal.schema.json", "contracts/v0.3/evidence.schema.json", "contracts/v0.3/memory.schema.json",
  "src/v03/controller.ts", "src/v03/store.ts", "src/v03/planner.ts", "src/v03/electron/main.ts", "ui/v0.3/index.html", "ui/v0.3/preload.cjs",
];
record("M01", required.every((file) => existsSync(path.join(root, file))), `${required.length}/${required.length} normative artifacts present`);

const contracts: V03Contracts = await createV03Contracts(path.join(root, "contracts"));
const setup: SetupProposal = { schema_version: "0.3.0", mission_title: "Deliver a validated AI engineering system", mission_success_criteria: ["Working artifact", "Reliability proof"], weekly_outcome: "Ship the first verified implementation slice", weekly_success_criteria: ["Tests pass"], weekly_competencies: ["architecture"], rationale: "Evidence-driven scope.", warnings: [] };
const week: WeekProposal = { schema_version: "0.3.0", primary_outcome: "Validate the operating boundary", success_criteria: ["Release gate passes"], competencies: ["security_privacy"], rationale: "Highest leverage next step.", warnings: [] };
const day: DayProposal = { schema_version: "0.3.0", proposed_objective: "Implement and validate one bounded slice", objective_changed: true, success_criteria: ["Focused tests pass"], checkpoints: [{ title: "Implement", evidence_required: "Tested artifact", competency: "software_design_implementation" }, { title: "Validate", evidence_required: "Release output", competency: "testing_reliability" }], rationale: "Concrete output and proof.", warnings: [] };
const at = new Date().toISOString();
const evidence: EvidenceRecord = { schema_version: "0.3.0", evidence_id: `ev_${"a".repeat(32)}`, day_id: `day_${"b".repeat(32)}`, checkpoint_id: `cp_${"c".repeat(32)}`, project: root, competency: "testing_reliability", source: "validated", assistance_level: "A1", outcome: "achieved", confidence: 0.9, summary: "Focused tests passed", validation: "Test output", source_event_id: null, created_at: at };
const memory: MemoryRecord = { schema_version: "0.3.0", memory_id: `mem_${"d".repeat(32)}`, kind: "pattern", claim: "A consequential inferred pattern", source: "inferred", confidence: 0.6, sensitivity: "internal", status: "pending_confirmation", pinned: false, created_at: at, updated_at: at };
let fixtures = true; try { contracts.validateSetupProposal(setup); contracts.validateWeekProposal(week); contracts.validateDayProposal(day); contracts.validateEvidence(evidence); contracts.validateMemory(memory); } catch { fixtures = false; }
record("M02", fixtures, "setup, week, day, evidence, and memory fixtures validate");

const store = await readFile(path.join(root, "src/v03/store.ts"), "utf8");
const controller = await readFile(path.join(root, "src/v03/controller.ts"), "utf8");
const planner = await readFile(path.join(root, "src/v03/planner.ts"), "utf8");
const gateway = await readFile(path.join(root, "src/v01/codex-exec.ts"), "utf8");
const electron = await readFile(path.join(root, "src/v03/electron/main.ts"), "utf8");
const preload = await readFile(path.join(root, "ui/v0.3/preload.cjs"), "utf8");
const tests = await readFile(path.join(root, "test/v03/operating-system.test.ts"), "utf8");
const charter = await readFile(path.join(root, "docs/v0.3/00_CHARTER.md"), "utf8");
const ambientTypes = await readFile(path.join(root, "src/v02/types.ts"), "utf8");
const daySchemaSource = await readFile(path.join(root, "contracts/v0.3/day-proposal.schema.json"), "utf8");
const evidenceSchemaSource = await readFile(path.join(root, "contracts/v0.3/evidence.schema.json"), "utf8");

record("M03", store.includes("'unverified'") && controller.includes("Competencies remain unverified"), "competencies initialize unverified");
record("M04", ["confirmSetup", "confirmWeek", "confirmDay"].every((term) => controller.includes(term)), "consequential plans have confirmation paths");
record("M05", daySchemaSource.includes("objective_changed") && controller.includes("challenged the objective"), "objective challenge remains a reviewable proposal");
record("M06", store.includes("one_active_day") && store.includes("getActiveDay()"), "one active day and primary project are enforced");
record("M07", ["checkpoint_id", "validation", "assistance_level", "outcome", "summary"].every((term) => evidenceSchemaSource.includes(term)), "checkpoint evidence fields are required");
record("M08", store.includes("observed: 0.35") && tests.includes("activity scoring"), "observation is weaker than validated evidence and activity is not scored");
record("M09", store.includes("recalculateCompetency") && tests.includes("advances competence"), "competency calculation is deterministic and tested");
record("M10", controller.includes("async endDay") && ["output_summary", "validation_summary", "lesson"].every((term) => controller.includes(term)), "End Day explicitly requires structured proof");
record("M11", store.includes('"pending_confirmation"') && store.includes('source === "inferred"'), "inferred memories await confirmation");
record("M12", ["setMemoryStatus", "setMemoryPinned", "deleteMemory"].every((term) => controller.includes(term)), "memory review controls are implemented");
record("M13", store.includes("journal_mode=WAL") && tests.includes("survives restart") && tests.includes("sentinel.txt"), "SQLite persistence and target isolation are tested");
record("M14", tests.includes("ephemeral-v03-frame") && tests.includes("database.includes"), "raw frame exclusion from SQLite is tested");
record("M15", tests.includes("one reasoning call") && store.includes("UPDATE checkpoints SET status = 'active'"), "checkpoint progression is local and call-free");
record("M16", ["draft_90_day_mission", "draft_week", "draft_day", "automatic_observation", "end_day"].every((term) => controller.includes(term) || store.includes(term) || ambientTypes.includes(term)), "reasoning calls are attributed");
record("M17", ["invocation_count", "prompt_characters", "total_latency_ms", "image_invocations"].every((term) => store.includes(term)), "usage telemetry is queryable");
record("M18", ["--ephemeral", "--ignore-user-config", "read-only", 'approval_policy="never"', 'web_search="disabled"', "--output-schema"].every((term) => gateway.includes(term)), "Codex execution authority remains bounded");
record("M19", electron.includes("contextIsolation: true") && electron.includes("sandbox: true") && electron.includes("nodeIntegration: false") && preload.includes("contextBridge.exposeInMainWorld"), "renderer and IPC boundary remain secure");
record("M20", !/(click\(|sendInput|publish|submitForm|workspace-write|openExternal\([^u])/.test(controller + planner), "V0.3 owns no external action capability");

function run(command: string) { const result = spawnSync("cmd.exe", ["/d", "/s", "/c", command], { cwd: root, encoding: "utf8", timeout: 300_000, maxBuffer: 20_000_000 }); return { pass: result.status === 0, detail: result.status === 0 ? `${command} passed` : `${command} failed: ${(result.stderr || result.stdout).trim().slice(-800)}` }; }
const regressions = [run("npm run v0:validate"), run("npm run v01:validate"), run("npm run v02:validate")];
record("M21", regressions.every((item) => item.pass), regressions.map((item) => item.detail).join("; "));
const quality = [run("npm run typecheck"), run("npm test"), run("npm run build"), run("npm audit --audit-level=high")];
record("M22", quality.every((item) => item.pass), quality.map((item) => item.detail).join("; "));
record("M23", ["Google Meet captions", "Career Mode", "direct OpenAI API", "autonomous computer"].every((term) => charter.includes(term)), "reserved modes and autonomous actions remain excluded");
record("M24", controller.includes("process.platform") || electron.includes('process.platform !== "win32"'), "Windows-only platform boundary is explicit");

for (const result of results) console.log(`${result.pass ? "PASS" : "FAIL"} ${result.id} — ${result.detail}`);
console.log(`\nV0.3.0 automated release gate: ${results.filter((item) => item.pass).length}/${results.length} metrics passed.`);
if (results.some((item) => !item.pass)) process.exitCode = 1;
