import path from "node:path";
import os from "node:os";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export interface CoachingConfig {
  applicationRoot: string;
  dataDirectory: string;
  contractsDirectory: string;
  responseSchemaPath: string;
  codexBinary: string | null;
  codexTimeoutMs: number;
  contextCharacterBudget: number;
  selectedFileCharacterLimit: number;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function detectApplicationRoot(): string {
  if (process.env.KOVACS_HOME) return process.env.KOVACS_HOME;
  const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    process.cwd(),
    path.resolve(moduleDirectory, "..", ".."),
    path.resolve(moduleDirectory, "..", "..", ".."),
  ];
  return candidates.find((candidate) => existsSync(path.join(candidate, "contracts", "v0.1"))) ?? process.cwd();
}

export function loadCoachingConfig(applicationRoot = detectApplicationRoot()): CoachingConfig {
  const root = path.resolve(applicationRoot);
  const localAppData = process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local");
  const contractsDirectory = path.join(root, "contracts");

  return {
    applicationRoot: root,
    dataDirectory: path.resolve(process.env.KOVACS_DATA_DIR ?? path.join(localAppData, "Kovacs", "v0.1")),
    contractsDirectory,
    responseSchemaPath: path.join(contractsDirectory, "v0.1", "profile-response.schema.json"),
    codexBinary: process.env.KOVACS_CODEX_BIN ?? null,
    codexTimeoutMs: positiveInteger(process.env.KOVACS_CODEX_TIMEOUT_MS, 120_000),
    contextCharacterBudget: positiveInteger(process.env.KOVACS_CONTEXT_CHARACTER_BUDGET, 40_000),
    selectedFileCharacterLimit: positiveInteger(process.env.KOVACS_SELECTED_FILE_CHARACTER_LIMIT, 16_000),
  };
}
