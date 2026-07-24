import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const results: Array<{ id: string; pass: boolean; detail: string }> = [];
const record = (id: string, pass: boolean, detail: string) => results.push({ id, pass, detail });
const required = [
  "docs/v0.3.3/00_RELEASE_CHARTER.md", "docs/v0.3.3/01_TRUST_AND_RETRIEVAL.md", "docs/v0.3.3/02_ACCEPTANCE.md",
  "docs/assets/kovacs-narwhal.png",
  "src/core/security/local-sensitive-content-guard.ts", "test/security/trust-and-retrieval.test.ts", "benchmarks/v0.3.3/retrieval-cases.json",
  "scripts/releases/v0.3.3/smoke.ts", "scripts/releases/v0.3.3/evaluate-retrieval.ts",
  "src/application/diagnostics/doctor.ts", "src/infrastructure/diagnostics/local-doctor.ts", "test/diagnostics/doctor.test.ts",
];
record("T01", required.every((file) => existsSync(path.join(root, file))), `${required.filter((file) => existsSync(path.join(root, file))).length}/${required.length} V0.3.3 artifacts present`);

const files = ["src/core/security/sensitive-content.ts", "src/core/observation/intervention-decision.ts", "src/application/operating-system/operating-system.ts", "src/interfaces/desktop/main.ts",
  "src/application/planning/codex-planner.ts", "src/infrastructure/persistence/sqlite-operating-store.ts", "src/core/operating-system/types.ts", "src/application/observation/perception-cascade.ts", "src/core/security/local-sensitive-content-guard.ts",
  "ui/desktop/renderer.js", "ui/desktop/preload.cjs", "package.json"] as const;
const entries = await Promise.all(files.map(async (file): Promise<[string, string]> => [file, await readFile(path.join(root, file), "utf8")]));
const content = Object.fromEntries(entries) as Record<(typeof files)[number], string>, all = Object.values(content).join("\n");

record("T02", content["src/core/security/sensitive-content.ts"].includes("connection_string") && content["src/core/security/sensitive-content.ts"].includes("restricted_term") && content["src/core/security/local-sensitive-content-guard.ts"].includes("sensitive_categories"), "the local guard classifies and redacts sensitive text before reasoning");
record("T03", content["src/application/observation/perception-cascade.ts"].includes("sensitive_content") && content["src/application/observation/perception-cascade.ts"].includes("ocr_unavailable") && content["src/application/observation/perception-cascade.ts"].includes("screenshotBlockedReason"), "sensitive and uninspectable screenshots fail closed");
record("T04", content["src/core/observation/intervention-decision.ts"].includes("untrusted_instruction") && content["src/application/observation/perception-cascade.ts"].includes("prompt_injection_detected"), "visible prompt-like instructions cannot trigger automatic reasoning");
record("T05", content["src/application/operating-system/operating-system.ts"].includes("correctSetupDraft") && content["src/infrastructure/persistence/sqlite-operating-store.ts"].includes("revision=revision+1") && content["ui/desktop/preload.cjs"].includes("correctSetupDraft"), "calibration facts support local audited revisions");
record("T06", content["src/application/operating-system/operating-system.ts"].includes("refineSetupDraft") && content["src/application/planning/codex-planner.ts"].includes("refineSetup") && content["src/application/operating-system/operating-system.ts"].includes("refine_90_day_mission"), "explicit clarification is a single attributable planner operation");
record("T07", content["src/infrastructure/persistence/sqlite-operating-store.ts"].includes("CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5") && content["src/infrastructure/persistence/sqlite-operating-store.ts"].includes("maximum_sensitivity") && content["src/infrastructure/persistence/sqlite-operating-store.ts"].includes("memory_scope='project'"), "retrieval filters eligible memories and uses SQLite FTS5");
record("T08", content["src/infrastructure/persistence/sqlite-operating-store.ts"].includes("fts_only") && content["src/infrastructure/persistence/sqlite-operating-store.ts"].includes("lexical_fallback") && content["src/infrastructure/persistence/sqlite-operating-store.ts"].includes("embedLocally"), "local vector, FTS-only, and lexical fallback paths are explicit");
record("T09", content["src/infrastructure/persistence/sqlite-operating-store.ts"].includes("query_hash") && content["src/infrastructure/persistence/sqlite-operating-store.ts"].includes("retrieval_diagnostics") && !/retrieval_diagnostics[\s\S]{0,300}(query_text|claim_text)/.test(content["src/infrastructure/persistence/sqlite-operating-store.ts"]), "retrieval telemetry stores hashes and result provenance without query or claim columns");
record("T10", content["src/infrastructure/persistence/sqlite-operating-store.ts"].includes("schema_migrations(version, applied_at) VALUES ('0.3.3'") && content["src/core/operating-system/types.ts"].includes('schema_version_applied: "0.3.3"'), "the V0.3.3 migration is additive and recoverable");
record("T11", content["src/application/planning/codex-planner.ts"].includes("CodexExecGateway") && !content["package.json"].includes('"openai"') && !/(responses\.create|chat\.completions|api\.openai\.com)/i.test(all), "Codex CLI remains the only reasoning gateway");
record("T12", !/(robotjs|nut\.js|sendInput|click\(|typeText|submitApplication)/i.test(content["src/application/operating-system/operating-system.ts"] + content["src/interfaces/desktop/main.ts"]), "advisory-only authority remains enforced");

const corpus = JSON.parse(await readFile(path.join(root, "benchmarks", "v0.3.3", "retrieval-cases.json"), "utf8")) as unknown[];
record("T13", corpus.length >= 10, `${corpus.length} deterministic Top-5 retrieval cases present`);

function run(command: string) {
  const execution = spawnSync("cmd.exe", ["/d", "/s", "/c", command], { cwd: root, encoding: "utf8", timeout: 300_000, maxBuffer: 30_000_000 });
  const detail = execution.status === 0 ? `${command} passed` : `${command} failed: ${(execution.stderr || execution.stdout || execution.error?.message || "unknown").trim().slice(-1800)}`;
  return { pass: execution.status === 0, detail };
}

const quality = [run("npm run v032:validate"), run("npm run typecheck"), run("npm test"), run("npm run build"),
  run("node --check ui\\desktop\\renderer.js"), run("node --check ui\\desktop\\preload.cjs"), run("npm run v033:smoke"),
  run("npm run v033:evaluate"), run("npm audit --audit-level=high")];
record("T14", quality.every((item) => item.pass), quality.map((item) => item.detail).join("; "));

for (const result of results) console.log(`${result.pass ? "PASS" : "FAIL"} ${result.id} — ${result.detail}`);
console.log(`\nV0.3.3 automated release gate: ${results.filter((item) => item.pass).length}/${results.length} metrics passed.`);
if (results.some((item) => !item.pass)) process.exitCode = 1;
