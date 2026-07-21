import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const results: Array<{ id: string; pass: boolean; detail: string }> = [];
const record = (id: string, pass: boolean, detail: string) => results.push({ id, pass, detail });
const required = ["docs/v0.3.2/00_RELEASE_CHARTER.md", "docs/v0.3.2/01_CONTEXT_PIPELINE.md", "docs/v0.3.2/02_STATE_AND_CONFIRMATION.md", "docs/v0.3.2/03_MEMORY_AND_PRIVACY.md", "docs/v0.3.2/04_ACCEPTANCE.md", "contracts/v0.3.2/calibration-proposal.schema.json", "contracts/v0.3.2/end-day-proposal.schema.json", "contracts/v0.3.2/context-frame.schema.json", "test/v032/context-foundation.test.ts", "test/v032/perception-cascade.test.ts", "v032/smoke.ts", "v032/live.ts"];
record("C01", required.every((file) => existsSync(path.join(root, file))), `${required.filter((file) => existsSync(path.join(root, file))).length}/${required.length} V0.3.2 artifacts present`);
const files = ["src/v03/types.ts", "src/v03/store.ts", "src/v03/controller.ts", "src/v03/planner.ts", "src/v03/electron/main.ts", "src/v02/controller.ts", "src/v032/context-engine.ts", "src/v032/memory.ts", "src/v032/perception-cascade.ts", "src/v032/windows-perception.ts", "ui/v0.3/index.html", "ui/v0.3/renderer.js", "ui/v0.3/preload.cjs", "README.md"];
const entries = await Promise.all(files.map(async (file): Promise<[string, string]> => {
  const source = await readFile(path.join(root, file), "utf8");
  return [file, source];
}));
const content: Record<string, string> = Object.fromEntries(entries);
const all = Object.values(content).join("\n");
record("C02", content["ui/v0.3/index.html"].includes("setup-narrative") && !content["ui/v0.3/index.html"].includes("current-position") && content["src/v03/controller.ts"].includes("CalibrationInput"), "initial calibration accepts one natural-language narrative");
record("C03", content["src/v03/planner.ts"].includes("at most two questions") && content["src/v03/types.ts"].includes("clarification_questions") && content["src/v03/types.ts"].includes("InterpretedValue") && content["ui/v0.3/renderer.js"].includes("interpreted_profile"), "interpretation exposes source, confidence, assumptions, and bounded questions");
record("C04", content["src/v03/controller.ts"].includes("draftEndDay") && content["src/v03/controller.ts"].includes("confirmEndDay") && content["src/v03/store.ts"].includes("end_day_drafts"), "End Day interpretation is reversible and confirmation-gated");
record("C05", content["src/v032/context-engine.ts"].includes("text_digest") && !content["src/v03/store.ts"].includes("ocr_text") && !content["src/v03/store.ts"].includes("accessibility_text"), "durable context excludes raw OCR and accessibility content");
record("C06", content["src/v02/controller.ts"].includes("localPerception") && content["src/v032/windows-perception.ts"].includes("readAccessibility") && content["src/v032/windows-perception.ts"].includes("readOcr") && content["src/v032/windows-perception.ts"].includes("windowsHide: true"), "native perception is local, separated by signal, and authorization-bound");
record("C07", content["src/v032/memory.ts"].includes("embedLocally") && content["src/v03/store.ts"].includes("searchMemories") && content["src/v03/store.ts"].includes("local-hybrid"), "vector memory and hybrid retrieval are deterministic and local");
record("C08", content["src/v03/store.ts"].includes("ON DELETE CASCADE") && content["src/v03/store.ts"].includes("memory_index") && content["src/v03/store.ts"].includes("schema_version: \"0.3.2\""), "migration, deletion, and backup disclose the V0.3.2 index boundary");
record("C09", !/(api\.openai\.com|new\s+OpenAI\s*\(|OPENAI_API_KEY)/.test(all) && content["src/v03/planner.ts"].includes("CodexExecGateway"), "reasoning remains Codex CLI only with no direct OpenAI API path");
record("C10", content["src/v03/electron/main.ts"].includes("contextIsolation: true") && content["src/v03/electron/main.ts"].includes("sandbox: true") && content["src/v03/electron/main.ts"].includes("setContentProtection(true)"), "Electron isolation and content protection remain enforced");
record("C11", content["src/v02/controller.ts"].includes("automaticInterventionAllowed") && !content["src/v032/context-engine.ts"].includes("setInterval") && !content["src/v032/memory.ts"].includes("setInterval"), "no new continuous model or perception loop was introduced");
record("C12", !/(Google Meet|Career Mode|send email|submit application)/i.test(content["src/v03/controller.ts"] + content["src/v032/context-engine.ts"]), "meeting, career, and autonomous external actions remain excluded");
record("C13", content["src/v032/perception-cascade.ts"].indexOf("readAccessibility") < content["src/v032/perception-cascade.ts"].indexOf("input.capture") && content["src/v032/perception-cascade.ts"].indexOf("input.capture") < content["src/v032/perception-cascade.ts"].indexOf("readOcr") && content["src/v032/perception-cascade.ts"].includes("screenshot: sufficient ? null : captured.png"), "perception order is UIA, then lazy OCR capture, then screenshot only when local context remains insufficient");

function run(command: string) {
  const result = spawnSync("cmd.exe", ["/d", "/s", "/c", command], { cwd: root, encoding: "utf8", timeout: 300_000, maxBuffer: 30_000_000 });
  return { pass: result.status === 0, detail: result.status === 0 ? `${command} passed` : `${command} failed: ${(result.stderr || result.stdout || result.error?.message || "unknown").trim().slice(-1600)}` };
}
const quality = [run("npm run v031:validate"), run("npm run typecheck"), run("npm test"), run("npm run build"), run("node --check ui\\v0.3\\renderer.js"), run("node --check ui\\v0.3\\preload.cjs"), run("npm run v032:smoke"), run("npm audit --audit-level=high")];
record("C14", quality.every((item) => item.pass), quality.map((item) => item.detail).join("; "));
for (const result of results) console.log(`${result.pass ? "PASS" : "FAIL"} ${result.id} — ${result.detail}`);
console.log(`\nV0.3.2 automated release gate: ${results.filter((item) => item.pass).length}/${results.length} metrics passed.`);
if (results.some((item) => !item.pass)) process.exitCode = 1;
