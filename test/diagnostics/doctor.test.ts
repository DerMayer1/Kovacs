import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  doctorExitCode,
  runDoctor,
  type DoctorDependencies,
  type DoctorInput,
  type DoctorProbeResult,
  type DoctorReport,
} from "../../src/application/diagnostics/doctor.js";
import {
  createLocalDoctorDependencies,
  redactLocalPath,
} from "../../src/infrastructure/diagnostics/local-doctor.js";
import { renderDoctorReport, runCli } from "../../src/interfaces/cli/terminal.js";

const pass = (summary: string): DoctorProbeResult => ({ status: "pass", summary });
const input: DoctorInput = {
  contracts: ["contract-a.json"],
  dataDirectory: "data",
  databasePath: "data/kovacs.db",
  expectedSchemaVersion: "0.3.3",
  codexBinary: null,
  scriptsDirectory: "scripts",
};

function dependencies(overrides: Partial<DoctorDependencies> = {}): DoctorDependencies {
  return {
    platform: "win32",
    nodeVersion: "22.23.1",
    inspectContracts: async () => pass("contracts"),
    inspectDataDirectory: async () => pass("data"),
    inspectSqlite: async () => pass("sqlite"),
    inspectDatabase: async () => pass("database"),
    inspectCodex: async () => ({
      executable: pass("codex"),
      authentication: pass("authentication"),
    }),
    inspectWindowsHelpers: async () => pass("helpers"),
    ...overrides,
  };
}

test("doctor reports deterministic health without model calls", async () => {
  const report = await runDoctor(input, dependencies(), () => new Date("2026-07-24T00:00:00.000Z"));
  assert.equal(report.overall, "pass");
  assert.equal(report.model_calls, 0);
  assert.equal(report.generated_at, "2026-07-24T00:00:00.000Z");
  assert.deepEqual(report.checks.map((check) => check.id), [
    "platform",
    "runtime",
    "contracts",
    "data_directory",
    "sqlite",
    "database",
    "codex_executable",
    "codex_authentication",
    "windows_helpers",
  ]);
  assert.equal(doctorExitCode(report), 0);
});

test("first-run warnings remain non-fatal while required failures return exit code one", async () => {
  const warning = await runDoctor(input, dependencies({
    inspectDataDirectory: async () => ({ status: "warn", summary: "not initialized" }),
    inspectDatabase: async () => ({ status: "warn", summary: "not initialized" }),
  }));
  assert.equal(warning.overall, "warn");
  assert.equal(doctorExitCode(warning), 0);

  const failure = await runDoctor(input, dependencies({
    nodeVersion: "22.12.0",
    inspectCodex: async () => ({
      executable: { status: "fail", summary: "missing" },
      authentication: { status: "fail", summary: "unknown" },
    }),
  }));
  assert.equal(failure.overall, "fail");
  assert.equal(doctorExitCode(failure), 1);
  assert.equal(failure.checks.find((check) => check.id === "runtime")?.status, "fail");
});

test("unexpected probe errors fail closed without exposing the original error", async () => {
  const report = await runDoctor(input, dependencies({
    inspectContracts: async () => {
      throw new Error("C:\\Users\\private\\secret-contract.json");
    },
  }));
  const contracts = report.checks.find((check) => check.id === "contracts");
  assert.equal(contracts?.status, "fail");
  assert.doesNotMatch(contracts?.summary ?? "", /private|secret-contract/i);
});

test("doctor CLI supports redacted JSON and human output without constructing coaching state", async () => {
  const report = await runDoctor(input, dependencies(), () => new Date("2026-07-24T00:00:00.000Z"));
  const output: string[] = [];
  const originalLog = console.log;
  console.log = (...values: unknown[]) => { output.push(values.join(" ")); };
  try {
    assert.equal(await runCli(["doctor", "--json"], { doctor: async () => report }), 0);
    const encoded = output.pop() ?? "";
    assert.equal((JSON.parse(encoded) as DoctorReport).model_calls, 0);

    assert.equal(await runCli(["doctor"], { doctor: async () => report }), 0);
    assert.match(output.pop() ?? "", /Kovacs Doctor — PASS/);
    assert.match(renderDoctorReport(report), /Model calls: 0/);
  } finally {
    console.log = originalLog;
  }
});

test("local probes do not initialize missing state and fail closed on a corrupt database", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "kovacs-doctor-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const missingData = path.join(directory, "not-created");
  const corruptDatabase = path.join(directory, "corrupt.db");
  const local = createLocalDoctorDependencies();

  const missing = await local.inspectDataDirectory(missingData);
  assert.equal(missing.status, "warn");
  assert.equal(existsSync(missingData), false);

  await writeFile(corruptDatabase, "not a sqlite database", "utf8");
  const corrupt = await local.inspectDatabase(corruptDatabase, "0.3.3");
  assert.equal(corrupt.status, "fail");
  assert.doesNotMatch(corrupt.summary, new RegExp(os.homedir().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  assert.equal((await local.inspectSqlite()).status, "pass");
});

test("local paths are reduced to stable environment tokens", () => {
  const rendered = redactLocalPath(
    "C:\\Users\\lucas\\AppData\\Local\\Kovacs\\v0.3\\kovacs.db",
    {
      localAppData: "C:\\Users\\lucas\\AppData\\Local",
      home: "C:\\Users\\lucas",
    },
  );
  assert.equal(rendered, `%LOCALAPPDATA%${path.sep}Kovacs${path.sep}v0.3${path.sep}kovacs.db`);
  assert.doesNotMatch(rendered, /lucas/i);
});
