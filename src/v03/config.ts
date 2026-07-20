import os from "node:os";
import path from "node:path";
import { loadV02Config, type V02Config } from "../v02/config.js";

export interface V03Config {
  applicationRoot: string;
  dataDirectory: string;
  databasePath: string;
  contractsDirectory: string;
  setupSchemaPath: string;
  weekSchemaPath: string;
  daySchemaPath: string;
  v02: V02Config;
}

export function loadV03Config(applicationRoot?: string): V03Config {
  const v02 = loadV02Config(applicationRoot);
  const localAppData = process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local");
  const dataDirectory = path.resolve(process.env.KOVACS_V03_DATA_DIR ?? path.join(localAppData, "Kovacs", "v0.3"));
  const contractsDirectory = path.join(v02.applicationRoot, "contracts");
  return {
    applicationRoot: v02.applicationRoot,
    dataDirectory,
    databasePath: path.join(dataDirectory, "kovacs.db"),
    contractsDirectory,
    setupSchemaPath: path.join(contractsDirectory, "v0.3", "setup-proposal.schema.json"),
    weekSchemaPath: path.join(contractsDirectory, "v0.3", "week-proposal.schema.json"),
    daySchemaPath: path.join(contractsDirectory, "v0.3", "day-proposal.schema.json"),
    v02: {
      ...v02,
      dataDirectory: path.join(dataDirectory, "ambient"),
      v01: { ...v02.v01, dataDirectory: path.join(dataDirectory, "v01-sessions") },
    },
  };
}
