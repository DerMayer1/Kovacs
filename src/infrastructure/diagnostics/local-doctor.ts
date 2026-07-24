import { constants as fsConstants, existsSync } from "node:fs";
import { access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import {
  runDoctor,
  type DoctorDependencies,
  type DoctorInput,
  type DoctorProbeResult,
  type DoctorReport,
} from "../../application/diagnostics/doctor.js";
import { resolveCodexExecutable } from "../codex/codex-exec-gateway.js";
import { loadRuntimeConfig, type RuntimeConfig } from "../config/runtime-config.js";

interface RedactionRoots {
  localAppData?: string;
  home?: string;
}

export function redactLocalPath(candidate: string, roots: RedactionRoots = {}): string {
  const resolved = path.resolve(candidate);
  const substitutions = [
    { root: roots.localAppData ?? process.env.LOCALAPPDATA, token: "%LOCALAPPDATA%" },
    { root: roots.home ?? os.homedir(), token: "%USERPROFILE%" },
  ];
  for (const substitution of substitutions) {
    if (!substitution.root) continue;
    const root = path.resolve(substitution.root);
    const relative = path.relative(root, resolved);
    if (relative === "") return substitution.token;
    if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
      return `${substitution.token}${path.sep}${relative}`;
    }
  }
  return `<local-path>${path.sep}${path.basename(resolved)}`;
}

async function inspectContracts(paths: string[]): Promise<DoctorProbeResult> {
  const missing: string[] = [];
  for (const candidate of paths) {
    try {
      await access(candidate, fsConstants.R_OK);
    } catch {
      missing.push(path.basename(candidate));
    }
  }
  return missing.length === 0
    ? { status: "pass", summary: `${paths.length} required contract files are readable.` }
    : { status: "fail", summary: `Missing or unreadable contracts: ${missing.join(", ")}.` };
}

async function inspectDataDirectory(directory: string): Promise<DoctorProbeResult> {
  const redacted = redactLocalPath(directory);
  if (!existsSync(directory)) {
    return { status: "warn", summary: `${redacted} is not initialized yet; first launch may create it.` };
  }
  try {
    await access(directory, fsConstants.R_OK | fsConstants.W_OK);
    return { status: "pass", summary: `${redacted} is readable and writable.` };
  } catch {
    return { status: "fail", summary: `${redacted} is not readable and writable.` };
  }
}

async function inspectSqlite(): Promise<DoctorProbeResult> {
  const database = new DatabaseSync(":memory:");
  try {
    database.exec("CREATE VIRTUAL TABLE doctor_fts USING fts5(value)");
    const row = database.prepare("SELECT sqlite_version() version").get() as { version?: string } | undefined;
    return {
      status: "pass",
      summary: `SQLite ${row?.version ?? "available"} and FTS5 are available in memory.`,
    };
  } finally {
    database.close();
  }
}

async function inspectDatabase(databasePath: string, expectedSchemaVersion: string): Promise<DoctorProbeResult> {
  const redacted = redactLocalPath(databasePath);
  if (!existsSync(databasePath)) {
    return { status: "warn", summary: `${redacted} does not exist; no durable state has been initialized.` };
  }

  let database: DatabaseSync | null = null;
  try {
    database = new DatabaseSync(databasePath, { readOnly: true });
    const integrity = database.prepare("PRAGMA quick_check").get() as Record<string, unknown> | undefined;
    if (Object.values(integrity ?? {})[0] !== "ok") {
      return { status: "fail", summary: `${redacted} failed SQLite quick_check.` };
    }
    const migration = database
      .prepare("SELECT version FROM schema_migrations WHERE version = ?")
      .get(expectedSchemaVersion) as { version?: string } | undefined;
    return migration?.version === expectedSchemaVersion
      ? { status: "pass", summary: `${redacted} passed quick_check at schema ${expectedSchemaVersion}.` }
      : { status: "fail", summary: `${redacted} is healthy but missing schema ${expectedSchemaVersion}.` };
  } catch {
    return { status: "fail", summary: `${redacted} could not be opened read-only as a valid Kovacs database.` };
  } finally {
    database?.close();
  }
}

function safeVersion(output: string): string | null {
  return /\bcodex-cli\s+([0-9A-Za-z.-]+)/.exec(output)?.[1] ?? null;
}

async function inspectCodex(configuredBinary: string | null): Promise<{
  executable: DoctorProbeResult;
  authentication: DoctorProbeResult;
}> {
  const executable = await resolveCodexExecutable(configuredBinary);
  const version = spawnSync(executable, ["--version"], {
    encoding: "utf8",
    timeout: 5_000,
    windowsHide: true,
  });
  const parsedVersion = version.status === 0 ? safeVersion(`${version.stdout ?? ""}\n${version.stderr ?? ""}`) : null;
  if (!parsedVersion) {
    return {
      executable: { status: "fail", summary: "Codex CLI is unavailable or did not return a valid version." },
      authentication: { status: "fail", summary: "Codex authentication could not be verified." },
    };
  }

  const authentication = spawnSync(executable, ["login", "status"], {
    encoding: "utf8",
    timeout: 5_000,
    windowsHide: true,
  });
  const authenticated = authentication.status === 0
    && /logged in/i.test(`${authentication.stdout ?? ""}\n${authentication.stderr ?? ""}`);
  return {
    executable: { status: "pass", summary: `Codex CLI ${parsedVersion} is available.` },
    authentication: authenticated
      ? { status: "pass", summary: "Codex reports an authenticated local session." }
      : { status: "fail", summary: "Codex is installed but no authenticated session was confirmed." },
  };
}

async function inspectWindowsHelpers(scriptsDirectory: string): Promise<DoctorProbeResult> {
  const required = ["windows-uia.ps1", "windows-ocr.ps1"];
  const missing = required.filter((file) => !existsSync(path.join(scriptsDirectory, file)));
  if (missing.length > 0) {
    return { status: "fail", summary: `Missing Windows helper scripts: ${missing.join(", ")}.` };
  }
  const powershell = spawnSync(
    "powershell.exe",
    ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", "$PSVersionTable.PSVersion.ToString()"],
    { encoding: "utf8", timeout: 5_000, windowsHide: true },
  );
  return powershell.status === 0
    ? { status: "pass", summary: "PowerShell and local UIA/OCR helper scripts are available." }
    : { status: "fail", summary: "PowerShell could not start; local UIA/OCR helpers are unavailable." };
}

export function createLocalDoctorDependencies(): DoctorDependencies {
  return {
    platform: process.platform,
    nodeVersion: process.versions.node,
    inspectContracts,
    inspectDataDirectory,
    inspectSqlite,
    inspectDatabase,
    inspectCodex,
    inspectWindowsHelpers,
  };
}

function doctorInput(config: RuntimeConfig): DoctorInput {
  return {
    contracts: [
      config.setupSchemaPath,
      config.weekSchemaPath,
      config.daySchemaPath,
      config.calibrationSchemaPath,
      config.endDaySchemaPath,
      config.contextSchemaPath,
      config.observation.coaching.responseSchemaPath,
    ],
    dataDirectory: config.dataDirectory,
    databasePath: config.databasePath,
    expectedSchemaVersion: "0.3.3",
    codexBinary: config.observation.coaching.codexBinary,
    scriptsDirectory: path.join(config.applicationRoot, "scripts"),
  };
}

export async function diagnoseLocalSystem(applicationRoot?: string): Promise<DoctorReport> {
  const config = loadRuntimeConfig(applicationRoot);
  return runDoctor(doctorInput(config), createLocalDoctorDependencies());
}
