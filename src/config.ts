import path from "node:path";

export interface KovacsConfig {
  projectRoot: string;
  dataDirectory: string;
  databasePath: string;
  codexWorkingDirectory: string;
  interventionThreshold: number;
}

function parseThreshold(value: string | undefined): number {
  if (value === undefined) {
    return 0.65;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error("KOVACS_INTERVENTION_THRESHOLD must be between 0 and 1.");
  }
  return parsed;
}

export function loadConfig(cwd = process.cwd()): KovacsConfig {
  const projectRoot = path.resolve(cwd);
  const dataDirectory = path.resolve(
    projectRoot,
    process.env.KOVACS_DATA_DIR ?? "data",
  );

  return {
    projectRoot,
    dataDirectory,
    databasePath: path.join(dataDirectory, "kovacs.db"),
    codexWorkingDirectory: path.resolve(
      projectRoot,
      process.env.KOVACS_CODEX_WORKDIR ?? ".",
    ),
    interventionThreshold: parseThreshold(
      process.env.KOVACS_INTERVENTION_THRESHOLD,
    ),
  };
}
