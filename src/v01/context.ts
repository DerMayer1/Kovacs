import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import type { ManualRequest, PreparedContext } from "./types.js";
import { assertSensitivityAllowed, redactSecrets } from "./privacy.js";

export interface ContextLimits {
  characterBudget: number;
  selectedFileCharacterLimit: number;
}

function isInside(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function consume(value: string, remaining: { value: number }): { value: string; truncated: boolean } {
  const accepted = value.slice(0, Math.max(0, remaining.value));
  remaining.value -= accepted.length;
  return { value: accepted, truncated: accepted.length !== value.length };
}

export async function prepareContext(request: ManualRequest, limits: ContextLimits): Promise<PreparedContext> {
  assertSensitivityAllowed(request.sensitivity);
  const projectRoot = await realpath(request.project);
  const projectStat = await stat(projectRoot);
  if (!projectStat.isDirectory()) throw new Error(`Project is not a directory: ${request.project}`);

  const remaining = { value: limits.characterBudget };
  let redactionCount = 0;
  let truncated = false;

  const prepareText = (value: string): string => {
    const redacted = redactSecrets(value);
    redactionCount += redacted.count;
    const consumed = consume(redacted.text, remaining);
    truncated ||= consumed.truncated;
    return consumed.value;
  };

  const notes = prepareText(request.context.notes);
  const terminal = prepareText(request.context.terminal);
  const files: PreparedContext["files"] = [];

  for (const selected of request.context.selected_files) {
    const candidate = await realpath(path.resolve(projectRoot, selected));
    if (!isInside(projectRoot, candidate)) throw new Error(`Selected file escapes project root: ${selected}`);
    const candidateStat = await stat(candidate);
    if (!candidateStat.isFile()) throw new Error(`Selected path is not a file: ${selected}`);
    const raw = await readFile(candidate, "utf8");
    const limited = raw.slice(0, limits.selectedFileCharacterLimit);
    truncated ||= limited.length !== raw.length;
    const redacted = redactSecrets(limited);
    redactionCount += redacted.count;
    const consumed = consume(redacted.text, remaining);
    truncated ||= consumed.truncated;
    files.push({ path: path.relative(projectRoot, candidate), content: consumed.value });
    if (remaining.value <= 0) break;
  }

  return {
    terminal,
    notes,
    files,
    redaction_count: redactionCount,
    truncated,
    total_characters: limits.characterBudget - remaining.value,
  };
}
