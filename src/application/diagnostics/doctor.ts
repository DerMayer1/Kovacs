export type DoctorStatus = "pass" | "warn" | "fail";

export interface DoctorProbeResult {
  status: DoctorStatus;
  summary: string;
}

export interface DoctorCheck extends DoctorProbeResult {
  id: string;
  label: string;
}

export interface DoctorReport {
  schema_version: "1.0";
  generated_at: string;
  overall: DoctorStatus;
  model_calls: 0;
  checks: DoctorCheck[];
}

export interface DoctorInput {
  contracts: string[];
  dataDirectory: string;
  databasePath: string;
  expectedSchemaVersion: string;
  codexBinary: string | null;
  scriptsDirectory: string;
}

export interface DoctorDependencies {
  platform: string;
  nodeVersion: string;
  inspectContracts(paths: string[]): Promise<DoctorProbeResult>;
  inspectDataDirectory(directory: string): Promise<DoctorProbeResult>;
  inspectSqlite(): Promise<DoctorProbeResult>;
  inspectDatabase(databasePath: string, expectedSchemaVersion: string): Promise<DoctorProbeResult>;
  inspectCodex(configuredBinary: string | null): Promise<{
    executable: DoctorProbeResult;
    authentication: DoctorProbeResult;
  }>;
  inspectWindowsHelpers(scriptsDirectory: string): Promise<DoctorProbeResult>;
}

const REQUIRED_NODE = [22, 13, 0] as const;

function versionTuple(version: string): [number, number, number] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function supportsRequiredNode(version: string): boolean {
  const candidate = versionTuple(version);
  if (!candidate) return false;
  for (let index = 0; index < REQUIRED_NODE.length; index += 1) {
    if (candidate[index]! > REQUIRED_NODE[index]!) return true;
    if (candidate[index]! < REQUIRED_NODE[index]!) return false;
  }
  return true;
}

async function guarded(
  id: string,
  label: string,
  probe: () => Promise<DoctorProbeResult>,
): Promise<DoctorCheck> {
  try {
    return { id, label, ...await probe() };
  } catch {
    return { id, label, status: "fail", summary: "Probe could not complete safely." };
  }
}

export async function runDoctor(
  input: DoctorInput,
  dependencies: DoctorDependencies,
  now = () => new Date(),
): Promise<DoctorReport> {
  const checks: DoctorCheck[] = [
    {
      id: "platform",
      label: "Platform",
      status: dependencies.platform === "win32" ? "pass" : "fail",
      summary: dependencies.platform === "win32"
        ? "Windows runtime detected."
        : "Kovacs currently requires Windows.",
    },
    {
      id: "runtime",
      label: "Node runtime",
      status: supportsRequiredNode(dependencies.nodeVersion) ? "pass" : "fail",
      summary: supportsRequiredNode(dependencies.nodeVersion)
        ? `Node ${dependencies.nodeVersion} supports unflagged node:sqlite.`
        : `Node ${dependencies.nodeVersion} is unsupported; use Node 22.13.0 or newer.`,
    },
    await guarded("contracts", "Contracts", () => dependencies.inspectContracts(input.contracts)),
    await guarded("data_directory", "Data directory", () => dependencies.inspectDataDirectory(input.dataDirectory)),
    await guarded("sqlite", "SQLite capability", () => dependencies.inspectSqlite()),
    await guarded("database", "Database", () => dependencies.inspectDatabase(input.databasePath, input.expectedSchemaVersion)),
  ];

  const codex = await dependencies.inspectCodex(input.codexBinary).catch(() => ({
    executable: { status: "fail" as const, summary: "Codex executable probe could not complete safely." },
    authentication: { status: "fail" as const, summary: "Codex authentication could not be verified." },
  }));
  checks.push(
    { id: "codex_executable", label: "Codex CLI", ...codex.executable },
    { id: "codex_authentication", label: "Codex authentication", ...codex.authentication },
    await guarded("windows_helpers", "Windows helpers", () => dependencies.inspectWindowsHelpers(input.scriptsDirectory)),
  );

  const overall: DoctorStatus = checks.some((check) => check.status === "fail")
    ? "fail"
    : checks.some((check) => check.status === "warn")
      ? "warn"
      : "pass";

  return {
    schema_version: "1.0",
    generated_at: now().toISOString(),
    overall,
    model_calls: 0,
    checks,
  };
}

export function doctorExitCode(report: DoctorReport): 0 | 1 {
  return report.overall === "fail" ? 1 : 0;
}
