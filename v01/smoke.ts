import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadV01Config } from "../src/v01/config.js";
import { KovacsService } from "../src/v01/service.js";

const projectArgument = process.argv[2];
if (!projectArgument) throw new Error("Usage: npm run v01:smoke -- <target-project-path>");
const project = path.resolve(projectArgument);
const excluded = new Set([".git", "node_modules", "dist", ".next", "coverage"]);

async function snapshot(directory: string): Promise<string> {
  const hash = createHash("sha256");
  async function walk(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (excluded.has(entry.name)) continue;
      const absolute = path.join(current, entry.name);
      const relative = path.relative(directory, absolute).replaceAll("\\", "/");
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile()) {
        hash.update(relative); hash.update("\0"); hash.update(await readFile(absolute)); hash.update("\0");
      }
    }
  }
  if (!(await stat(directory)).isDirectory()) throw new Error("Target project is not a directory.");
  await walk(directory);
  return hash.digest("hex");
}

const temporary = await mkdtemp(path.join(os.tmpdir(), "kovacs-v01-smoke-"));
try {
  const before = await snapshot(project);
  const config = { ...loadV01Config(), dataDirectory: path.join(temporary, "data") };
  const service = await KovacsService.create(config);
  const session = await service.start(project, "Validate Kovacs V0.1 on a real repository without modifying it", "training");
  const coach = await service.intervene(session.session_id, "coach", { requestedHelp: "Based on the repository, give me one high-leverage next learning action.", allowedAssistance: "A2", selectedFiles: [] });
  const debrief = await service.intervene(session.session_id, "debrief", { requestedHelp: "Debrief this short validation session using only observed evidence.", allowedAssistance: "A2", selectedFiles: [] });
  const after = await snapshot(project);
  const finalSession = await service.status(session.session_id);
  const checks = {
    L01_schema_valid_coach: coach.response.profile === "coach",
    L02_assistance_within_ceiling: ["A0", "A1", "A2"].includes(coach.response.intervention.assistance_level),
    L03_observable_context: coach.response.observed_context.length > 0,
    L04_repository_unchanged: before === after,
    L05_valid_debrief: debrief.response.profile === "debrief" && finalSession.status === "completed",
  };
  console.log(JSON.stringify({ session_id: session.session_id, checks, coach: coach.response, debrief: debrief.response }, null, 2));
  if (Object.values(checks).some((value) => !value)) process.exitCode = 1;
} finally {
  await rm(temporary, { recursive: true, force: true });
}
