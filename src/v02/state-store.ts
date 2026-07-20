import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { AmbientContracts } from "./contracts.js";
import type { AmbientEvent, AmbientSettings, AmbientState } from "./types.js";

export class AmbientStateStore {
  private readonly statePath: string;
  private readonly settingsPath: string;

  constructor(private readonly dataDirectory: string, private readonly contracts: AmbientContracts) {
    this.statePath = path.join(dataDirectory, "current-day.json");
    this.settingsPath = path.join(dataDirectory, "settings.json");
  }

  private async atomicWrite(destination: string, value: unknown): Promise<void> {
    await mkdir(this.dataDirectory, { recursive: true });
    const temporary = `${destination}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    await rename(temporary, destination);
  }

  async loadState(): Promise<AmbientState | null> {
    try {
      const value: unknown = JSON.parse(await readFile(this.statePath, "utf8"));
      this.contracts.validateState(value);
      const state = value as AmbientState;
      const containedWindowTitles = state.events.some((event) => event.window_title !== null);
      if (containedWindowTitles) {
        state.events.forEach((event) => { event.window_title = null; });
        await this.saveState(state);
      }
      return state;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async saveState(state: AmbientState): Promise<void> {
    this.contracts.validateState(state); await this.atomicWrite(this.statePath, state);
  }

  async append(state: AmbientState, event: AmbientEvent): Promise<AmbientState> {
    this.contracts.validateEvent(event);
    state.events.push(event);
    await this.saveState(state);
    return state;
  }

  async loadSettings(defaults: AmbientSettings): Promise<AmbientSettings> {
    try {
      const value: unknown = JSON.parse(await readFile(this.settingsPath, "utf8"));
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Ambient settings must be an object.");
      const merged: unknown = { ...defaults, ...(value as Record<string, unknown>), schema_version: "0.2.0" };
      this.contracts.validateSettings(merged);
      if (JSON.stringify(value) !== JSON.stringify(merged)) await this.saveSettings(merged);
      return merged;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await this.saveSettings(defaults); return defaults;
    }
  }

  async saveSettings(settings: AmbientSettings): Promise<void> {
    this.contracts.validateSettings(settings); await this.atomicWrite(this.settingsPath, settings);
  }
}
