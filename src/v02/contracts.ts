import { readFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import type { AmbientEvent, AmbientSettings, AmbientState } from "./types.js";

const require = createRequire(import.meta.url);
const Ajv2020 = require("ajv/dist/2020").default;
const addFormats = require("ajv-formats").default;

export interface AmbientContracts {
  validateEvent(value: unknown): asserts value is AmbientEvent;
  validateState(value: unknown): asserts value is AmbientState;
  validateSettings(value: unknown): asserts value is AmbientSettings;
}

export async function createAmbientContracts(contractsDirectory: string): Promise<AmbientContracts> {
  const read = async (file: string) => JSON.parse(await readFile(path.join(contractsDirectory, "v0.2", file), "utf8"));
  const [eventSchema, stateSchema, settingsSchema] = await Promise.all([read("ambient-event.schema.json"), read("ambient-state.schema.json"), read("settings.schema.json")]);
  const ajv = new Ajv2020({ allErrors: true, strict: true }); addFormats(ajv); ajv.addSchema(eventSchema);
  const event = ajv.compile(eventSchema), state = ajv.compile(stateSchema), settings = ajv.compile(settingsSchema);
  const check = (label: string, validator: typeof event, value: unknown) => { if (!validator(value)) throw new Error(`${label} contract failed: ${ajv.errorsText(validator.errors)}`); };
  return {
    validateEvent(value: unknown): asserts value is AmbientEvent { check("Ambient event", event, value); },
    validateState(value: unknown): asserts value is AmbientState { check("Ambient state", state, value); },
    validateSettings(value: unknown): asserts value is AmbientSettings { check("Ambient settings", settings, value); },
  };
}
