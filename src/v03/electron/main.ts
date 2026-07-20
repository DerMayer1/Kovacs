import { app, BrowserWindow, globalShortcut, ipcMain, shell } from "electron";
import path from "node:path";
import { KovacsService } from "../../v01/service.js";
import { createAmbientContracts } from "../../v02/contracts.js";
import { AmbientController } from "../../v02/controller.js";
import { AmbientStateStore } from "../../v02/state-store.js";
import type { AmbientStatus } from "../../v02/types.js";
import { ElectronWindowCapture, WindowsActiveWindowProbe } from "../../v02/electron/adapters.js";
import { loadV03Config } from "../config.js";
import { createV03Contracts } from "../contracts.js";
import { V03Controller } from "../controller.js";
import { CodexV03Planner } from "../planner.js";
import { V03Store } from "../store.js";
import { DAY_OUTCOMES } from "../types.js";

if (process.platform !== "win32") throw new Error("Kovacs V0.3 pet currently supports Windows only.");
if (!app.requestSingleInstanceLock()) app.quit();

const config = loadV03Config();
let pet: BrowserWindow | null = null;
let controller: V03Controller;
let store: V03Store | null = null;
let interval: NodeJS.Timeout | null = null;

function payload(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Invalid ${label} payload.`);
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, maximum: number): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maximum) throw new Error(`${label} must be between 1 and ${maximum} characters.`);
  return value.trim();
}

function createPet(): BrowserWindow {
  const window = new BrowserWindow({
    width: 460, height: 780, minWidth: 390, minHeight: 600, show: false, frame: false, transparent: true,
    alwaysOnTop: true, resizable: true, maximizable: false, fullscreenable: false, skipTaskbar: false,
    backgroundColor: "#00000000", title: "Kovacs V0.3",
    webPreferences: {
      preload: path.join(config.applicationRoot, "ui", "v0.3", "preload.cjs"),
      contextIsolation: true, sandbox: true, nodeIntegration: false, webviewTag: false,
    },
  });
  window.setAlwaysOnTop(true, "floating");
  window.setContentProtection(true);
  window.setMenuBarVisibility(false);
  window.webContents.setWindowOpenHandler(({ url }) => { if (url.startsWith("https://")) void shell.openExternal(url); return { action: "deny" }; });
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  void window.loadFile(path.join(config.applicationRoot, "ui", "v0.3", "index.html"));
  window.once("ready-to-show", () => window.show());
  return window;
}

async function bootstrap(): Promise<void> {
  const [ambientContracts, v03Contracts] = await Promise.all([
    createAmbientContracts(config.contractsDirectory), createV03Contracts(config.contractsDirectory),
  ]);
  const ambientStore = new AmbientStateStore(config.v02.dataDirectory, ambientContracts);
  const settings = await ambientStore.loadSettings(config.v02.settings);
  const service = await KovacsService.create(config.v02.v01);
  store = await V03Store.create(config.databasePath, v03Contracts);
  let operating: V03Controller;
  const ambient = new AmbientController(service, ambientStore, settings, new WindowsActiveWindowProbe(), new ElectronWindowCapture(), {
    operatingContext: () => operating?.contextSummary() ?? "",
    onReasoningComplete: (telemetry) => operating?.recordAmbientInvocation(telemetry),
  });
  operating = new V03Controller(ambient, store, new CodexV03Planner(config, v03Contracts));
  controller = operating;
  await controller.initialize();
  pet = createPet();
  controller.onUpdate((update) => pet?.webContents.send("v03:update", update));

  ipcMain.handle("v03:bootstrap", () => ({ ambient: controller.getAmbientState(), operating: controller.snapshot(), settings, platform: process.platform, defaultProject: config.applicationRoot }));
  ipcMain.handle("v03:setup:draft", (_event, value: unknown) => {
    const input = payload(value, "setup");
    return controller.draftSetup({
      current_position: text(input.current_position, "Current position", 1000),
      available_hours_per_week: Number(input.available_hours_per_week),
      active_projects: text(input.active_projects, "Active projects", 2000),
      weaknesses: text(input.weaknesses, "Growth edges", 2000),
      desired_outcome: text(input.desired_outcome, "Desired outcome", 2000),
    });
  });
  ipcMain.handle("v03:setup:confirm", (_event, value: unknown) => controller.confirmSetup(text(payload(value, "setup confirmation").draft_id, "Draft identifier", 100)));
  ipcMain.handle("v03:week:draft", (_event, value: unknown) => {
    const input = payload(value, "week");
    return controller.draftWeek({ priorities: text(input.priorities, "Weekly priorities", 2000), constraints: text(input.constraints, "Weekly constraints", 2000) });
  });
  ipcMain.handle("v03:week:confirm", (_event, value: unknown) => controller.confirmWeek(text(payload(value, "week confirmation").draft_id, "Draft identifier", 100)));
  ipcMain.handle("v03:day:draft", (_event, value: unknown) => {
    const input = payload(value, "day");
    return controller.draftDay(text(input.project, "Project", 2048), text(input.objective, "Objective", 1000));
  });
  ipcMain.handle("v03:day:confirm", (_event, value: unknown) => controller.confirmDay(text(payload(value, "day confirmation").draft_id, "Draft identifier", 100)));
  ipcMain.handle("v03:status", (_event, value: unknown) => {
    const status = payload(value, "status").status;
    if (status !== "observing" && status !== "paused" && status !== "private") throw new Error("Invalid observation status.");
    return controller.setStatus(status as Extract<AmbientStatus, "observing" | "paused" | "private">);
  });
  ipcMain.handle("v03:observe", () => controller.observeNow());
  ipcMain.handle("v03:checkpoint", (_event, value: unknown) => {
    const input = payload(value, "checkpoint");
    const outcome = input.outcome;
    const assistance = input.assistance_level;
    if (outcome !== "achieved" && outcome !== "partially_achieved" && outcome !== "blocked") throw new Error("Invalid checkpoint outcome.");
    if (!["A0", "A1", "A2", "A3", "A4", "A5"].includes(String(assistance))) throw new Error("Invalid assistance level.");
    return controller.completeCheckpoint({ checkpoint_id: text(input.checkpoint_id, "Checkpoint identifier", 100), outcome, result: text(input.result, "Result", 2000), validation: text(input.validation, "Validation", 2000), assistance_level: assistance as "A0" | "A1" | "A2" | "A3" | "A4" | "A5" });
  });
  ipcMain.handle("v03:day:end", (_event, value: unknown) => {
    const input = payload(value, "end day");
    if (!DAY_OUTCOMES.includes(input.outcome as never)) throw new Error("Invalid day outcome.");
    return controller.endDay({ outcome: input.outcome as (typeof DAY_OUTCOMES)[number], output_summary: text(input.output_summary, "Output summary", 3000), validation_summary: text(input.validation_summary, "Validation summary", 3000), lesson: text(input.lesson, "Lesson", 2000) });
  });
  ipcMain.handle("v03:memory:status", (_event, value: unknown) => { const input = payload(value, "memory status"); const status = input.status; if (status !== "active" && status !== "pending_confirmation") throw new Error("Invalid memory status."); return controller.setMemoryStatus(text(input.memory_id, "Memory identifier", 100), status); });
  ipcMain.handle("v03:memory:pin", (_event, value: unknown) => { const input = payload(value, "memory pin"); if (typeof input.pinned !== "boolean") throw new Error("Invalid pinned value."); return controller.setMemoryPinned(text(input.memory_id, "Memory identifier", 100), input.pinned); });
  ipcMain.handle("v03:memory:delete", (_event, value: unknown) => controller.deleteMemory(text(payload(value, "memory delete").memory_id, "Memory identifier", 100)));
  ipcMain.handle("v03:close", async () => {
    const state = controller.getAmbientState();
    if (state && state.status !== "ended" && state.status !== "paused") await controller.setStatus("paused");
    pet?.close();
  });

  interval = setInterval(() => { void ambient.tick().catch((error: unknown) => pet?.webContents.send("v03:update", { ambient: controller.getAmbientState(), operating: controller.snapshot(), message: `Observation failed safely: ${(error as Error).message}` })); }, settings.sample_interval_ms);
  globalShortcut.register("CommandOrControl+Alt+K", () => {
    const state = controller.getAmbientState(); if (!state || state.status === "ended") return;
    void controller.setStatus(state.status === "observing" ? "paused" : "observing");
  });
}

app.whenReady().then(bootstrap).catch((error: unknown) => { console.error(`Kovacs pet failed: ${(error as Error).message}`); app.quit(); });
app.on("second-instance", () => { pet?.show(); pet?.focus(); });
app.on("before-quit", () => { if (interval) clearInterval(interval); globalShortcut.unregisterAll(); store?.close(); });
app.on("window-all-closed", () => app.quit());
