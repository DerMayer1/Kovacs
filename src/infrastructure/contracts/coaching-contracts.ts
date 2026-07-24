import { readFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import type { ManualRequest, ProfileResponse, SessionRecord } from "../../core/coaching/types.js";

const require = createRequire(import.meta.url);
const Ajv2020 = require("ajv/dist/2020").default as new (options?: object) => {
  addSchema(schema: object): void;
  compile(schema: object): ((value: unknown) => boolean) & { errors?: unknown };
};
const addFormats = require("ajv-formats").default as (ajv: object) => void;

export interface ContractValidator {
  validateRequest(value: unknown): asserts value is ManualRequest;
  validateResponse(value: unknown): asserts value is ProfileResponse;
  validateSession(value: unknown): asserts value is SessionRecord;
}

function formatErrors(errors: unknown): string {
  if (!Array.isArray(errors)) return "unknown schema violation";
  return errors
    .map((error) => {
      const item = error as { instancePath?: string; message?: string };
      return `${item.instancePath || "/"} ${item.message || "is invalid"}`;
    })
    .join("; ");
}

export async function createContractValidator(contractsDirectory: string): Promise<ContractValidator> {
  const load = async (relative: string): Promise<object> =>
    JSON.parse(await readFile(path.join(contractsDirectory, relative), "utf8")) as object;

  const [memorySchema, requestSchema, responseSchema, sessionSchema] = await Promise.all([
    load(path.join("v0", "memory-candidate.schema.json")),
    load(path.join("v0.1", "manual-request.schema.json")),
    load(path.join("v0.1", "profile-response.schema.json")),
    load(path.join("v0.1", "session.schema.json")),
  ]);

  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  ajv.addSchema(memorySchema);
  const request = ajv.compile(requestSchema);
  const response = ajv.compile(responseSchema);
  const session = ajv.compile(sessionSchema);

  const assertValid = (label: string, validate: typeof request, value: unknown): void => {
    if (!validate(value)) throw new Error(`${label} failed contract validation: ${formatErrors(validate.errors)}`);
  };

  return {
    validateRequest(value: unknown): asserts value is ManualRequest {
      assertValid("Manual request", request, value);
    },
    validateResponse(value: unknown): asserts value is ProfileResponse {
      assertValid("Profile response", response, value);
    },
    validateSession(value: unknown): asserts value is SessionRecord {
      assertValid("Session", session, value);
    },
  };
}
