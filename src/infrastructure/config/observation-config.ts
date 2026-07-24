import path from "node:path";
import os from "node:os";
import type { AmbientSettings } from "../../core/observation/types.js";
import { loadCoachingConfig, type CoachingConfig } from "./coaching-config.js";

export interface ObservationConfig {
  applicationRoot: string;
  dataDirectory: string;
  contractsDirectory: string;
  coaching: CoachingConfig;
  settings: AmbientSettings;
}

export function defaultAmbientSettings(): AmbientSettings {
  return {
    schema_version: "0.2.0",
    main_goal: "Become an Elite AI Systems Staff Engineer, using OpenAI as the benchmark of engineering efficiency, judgment, and impact.",
    allowed_applications: ["Code.exe", "WindowsTerminal.exe", "wt.exe", "cmd.exe", "powershell.exe", "pwsh.exe", "chrome.exe", "msedge.exe"],
    denied_title_patterns: ["password", "1password", "bitwarden", "keepass", "bank", "wallet", "incognito", "inprivate", "sign in", "login"],
    sample_interval_ms: 2500,
    automatic_intervention_interval_ms: 120000,
    focus_drift_ms: 120000,
    manual_window_grace_ms: 30000,
    frame_difference_threshold: 0.12,
    automatic_interventions: true,
  };
}

export function loadObservationConfig(applicationRoot?: string): ObservationConfig {
  const base = loadCoachingConfig(applicationRoot);
  const localAppData = process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local");
  const dataDirectory = path.resolve(process.env.KOVACS_V02_DATA_DIR ?? path.join(localAppData, "Kovacs", "v0.2"));
  return {
    applicationRoot: base.applicationRoot,
    dataDirectory,
    contractsDirectory: path.join(base.applicationRoot, "contracts"),
    coaching: { ...base, dataDirectory: path.join(dataDirectory, "v01-sessions") },
    settings: defaultAmbientSettings(),
  };
}
