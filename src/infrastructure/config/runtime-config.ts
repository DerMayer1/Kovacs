import os from "node:os";
import path from "node:path";
import { loadObservationConfig, type ObservationConfig } from "./observation-config.js";

export interface RuntimeConfig {
  applicationRoot: string;
  dataDirectory: string;
  databasePath: string;
  contractsDirectory: string;
  setupSchemaPath: string;
  weekSchemaPath: string;
  daySchemaPath: string;
  calibrationSchemaPath: string;
  endDaySchemaPath: string;
  contextSchemaPath: string;
  restrictedTerms: string[];
  observation: ObservationConfig;
}

export function loadRuntimeConfig(applicationRoot?: string): RuntimeConfig {
  const observation = loadObservationConfig(applicationRoot);
  const localAppData = process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local");
  const dataDirectory = path.resolve(process.env.KOVACS_V03_DATA_DIR ?? path.join(localAppData, "Kovacs", "v0.3"));
  const contractsDirectory = path.join(observation.applicationRoot, "contracts");
  return {
    applicationRoot: observation.applicationRoot,
    dataDirectory,
    databasePath: path.join(dataDirectory, "kovacs.db"),
    contractsDirectory,
    setupSchemaPath: path.join(contractsDirectory, "v0.3", "setup-proposal.schema.json"),
    weekSchemaPath: path.join(contractsDirectory, "v0.3", "week-proposal.schema.json"),
    daySchemaPath: path.join(contractsDirectory, "v0.3", "day-proposal.schema.json"),
    calibrationSchemaPath: path.join(contractsDirectory, "v0.3.2", "calibration-proposal.schema.json"),
    endDaySchemaPath: path.join(contractsDirectory, "v0.3.2", "end-day-proposal.schema.json"),
    contextSchemaPath: path.join(contractsDirectory, "v0.3.2", "context-frame.schema.json"),
    restrictedTerms: (process.env.KOVACS_RESTRICTED_TERMS ?? "").split(",").map((item) => item.trim()).filter((item) => item.length >= 2).slice(0, 100),
    observation: {
      ...observation,
      dataDirectory: path.join(dataDirectory, "ambient"),
      coaching: { ...observation.coaching, dataDirectory: path.join(dataDirectory, "v01-sessions") },
    },
  };
}
