import { readFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import type { DayProposal, EvidenceRecord, MemoryRecord, SetupProposal, WeekProposal } from "./types.js";

const require = createRequire(import.meta.url);
const Ajv2020 = require("ajv/dist/2020").default;
const addFormats = require("ajv-formats").default;

export interface V03Contracts {
  validateSetupProposal(value: unknown): asserts value is SetupProposal;
  validateWeekProposal(value: unknown): asserts value is WeekProposal;
  validateDayProposal(value: unknown): asserts value is DayProposal;
  validateEvidence(value: unknown): asserts value is EvidenceRecord;
  validateMemory(value: unknown): asserts value is MemoryRecord;
}

export async function createV03Contracts(contractsDirectory: string): Promise<V03Contracts> {
  const read = async (file: string): Promise<unknown> => JSON.parse(await readFile(path.join(contractsDirectory, "v0.3", file), "utf8"));
  const [setupSchema, weekSchema, daySchema, evidenceSchema, memorySchema] = await Promise.all([
    read("setup-proposal.schema.json"),
    read("week-proposal.schema.json"),
    read("day-proposal.schema.json"),
    read("evidence.schema.json"),
    read("memory.schema.json"),
  ]);
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const setup = ajv.compile(setupSchema);
  const week = ajv.compile(weekSchema);
  const day = ajv.compile(daySchema);
  const evidence = ajv.compile(evidenceSchema);
  const memory = ajv.compile(memorySchema);
  const check = (label: string, validator: typeof setup, value: unknown): void => {
    if (!validator(value)) throw new Error(`${label} contract failed: ${ajv.errorsText(validator.errors)}`);
  };
  return {
    validateSetupProposal(value: unknown): asserts value is SetupProposal { check("Setup proposal", setup, value); },
    validateWeekProposal(value: unknown): asserts value is WeekProposal { check("Week proposal", week, value); },
    validateDayProposal(value: unknown): asserts value is DayProposal { check("Day proposal", day, value); },
    validateEvidence(value: unknown): asserts value is EvidenceRecord { check("Evidence", evidence, value); },
    validateMemory(value: unknown): asserts value is MemoryRecord { check("Memory", memory, value); },
  };
}
