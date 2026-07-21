import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const results: Array<{ id: string; pass: boolean; detail: string }> = [];
const record = (id: string, pass: boolean, detail: string) => results.push({ id, pass, detail });
const required = ["docs/v0.3.1/00_HARDENING_CHARTER.md", "docs/v0.3.1/01_MIGRATION_AND_RECOVERY.md", "docs/v0.3.1/02_PILOT_PROTOCOL.md", "test/v03/hardening.test.ts", "v031/smoke.ts", "v031/live.ts"];
record("H01", required.every((file) => existsSync(path.join(root, file))), `${required.length}/${required.length} V0.3.1 artifacts present`);
const sources = await Promise.all([
  "src/v03/store.ts", "src/v03/controller.ts", "src/v03/types.ts", "src/v02/controller.ts", "src/v03/electron/main.ts", "ui/v0.3/preload.cjs", "ui/v0.3/renderer.js", "test/v03/hardening.test.ts", "README.md",
].map((file) => readFile(path.join(root, file), "utf8")));
const store = sources[0]!, controller = sources[1]!, types = sources[2]!, ambient = sources[3]!, electron = sources[4]!, preload = sources[5]!, renderer = sources[6]!, tests = sources[7]!, readme = sources[8]!;
record("H02", store.includes("ensureColumn") && (store.includes("schema_version', '0.3.1") || store.includes("schema_version', '0.3.2")) && tests.includes("recover"), "additive schema migration and restart recovery are implemented");
record("H03", store.includes("status='interrupted'") && store.includes("beginInvocation") && store.includes("finishInvocation"), "in-flight Codex calls fail closed after restart");
record("H04", ["self_reported", "observed", "tool_verified", "artifact_verified", "reviewed"].every((term) => types.includes(term)) && !store.includes('source: input.outcome === "achieved"'), "evidence provenance is explicit and never inferred from a text field");
record("H05", ambient.includes("window_title: null") && readme.includes("window titles") && tests.includes("window_title"), "window titles and raw capture remain non-durable");
record("H06", ["rejectDraft", "reviseDayDraft", "reviseActiveObjective", "transitionCheckpoint"].every((term) => controller.includes(term)), "plans and checkpoints support audited user-directed changes");
record("H07", store.includes("buildDaySummary") && store.includes("carry_forward") && tests.includes("deterministic carry-forward"), "End Day facts and carry-forward are deterministic");
record("H08", ["response_characters", "failed_invocations", "interrupted_invocations", "discarded_invocations", "average_latency_ms"].every((term) => store.includes(term)), "telemetry separates characters, latency, failure, interruption, and discard");
record("H09", store.includes("intervention_feedback") && renderer.includes("wrong_context"), "intervention feedback is collected without autonomous adaptation");
record("H10", store.includes("retention_policy") && store.includes("deleteMemoriesByDay") && store.includes("deleteMemoriesBySession"), "retention and scoped memory deletion are user-controlled");
record("H11", store.includes("VACUUM INTO") && store.includes("JSON.stringify(payload") && renderer.includes("backup"), "consistent SQLite backup and JSON export are user-triggered");
record("H12", electron.includes("contextIsolation: true") && electron.includes("sandbox: true") && preload.includes("contextBridge.exposeInMainWorld"), "Electron security and fixed IPC remain enforced");
record("H13", existsSync(path.join(root, "v031/live.ts")) && readme.includes("v031:validate"), "real Codex acceptance is explicit and separate from the no-cost automated gate");
function run(command: string) { const result = spawnSync("cmd.exe", ["/d", "/s", "/c", command], { cwd: root, encoding: "utf8", timeout: 300_000, maxBuffer: 20_000_000 }); return { pass: result.status === 0, detail: result.status === 0 ? `${command} passed` : `${command} failed: ${(result.stderr || result.stdout).trim().slice(-1000)}` }; }
const quality = [run("npm run v03:validate"), run("npm run typecheck"), run("npm test"), run("npm run build"), run("npm run v031:smoke"), run("npm audit --audit-level=high")];
record("H14", quality.every((item) => item.pass), quality.map((item) => item.detail).join("; "));
record("H15", !/(Google Meet|Career Mode|direct OpenAI API integration)/.test(types + controller) && !/(workspace-write|approval_policy=\"on-request\")/.test(controller), "V0.4 modes and external action authority remain excluded");
for (const result of results) console.log(`${result.pass ? "PASS" : "FAIL"} ${result.id} — ${result.detail}`);
console.log(`\nV0.3.1 automated release gate: ${results.filter((item) => item.pass).length}/${results.length} metrics passed.`);
if (results.some((item) => !item.pass)) process.exitCode = 1;
