import { app, BrowserWindow, globalShortcut, ipcMain, shell } from "electron";
import path from "node:path";
import { KovacsService } from "../../application/coaching/coaching-service.js";
import { loadObservationConfig } from "../../infrastructure/config/observation-config.js";
import { createObservationContracts } from "../../infrastructure/contracts/observation-contracts.js";
import { ObservationStateStore } from "../../infrastructure/persistence/observation-state-store.js";
import { ObservationController } from "../../application/observation/observation-controller.js";
import { ElectronWindowCapture, WindowsActiveWindowProbe } from "../../infrastructure/windows/electron-observation-adapters.js";
import type { AmbientStatus } from "../../core/observation/types.js";

if (process.platform !== "win32") throw new Error("Kovacs V0.2 pet currently supports Windows only.");
if (!app.requestSingleInstanceLock()) app.quit();

const config = loadObservationConfig();
let pet: BrowserWindow | null = null;
let controller: ObservationController;
let interval: NodeJS.Timeout | null = null;

function cleanText(value: unknown, label: string, maximum: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > maximum) throw new Error(`${label} must be between 1 and ${maximum} characters.`);
  return value.trim();
}

function createPet(): BrowserWindow {
  const window = new BrowserWindow({
    width: 390, height: 620, minWidth: 340, minHeight: 480, show: false, frame: false, transparent: true,
    alwaysOnTop: true, resizable: true, maximizable: false, fullscreenable: false, skipTaskbar: false,
    backgroundColor: "#00000000", title: "Kovacs V0.2",
    webPreferences: {
      preload: path.join(config.applicationRoot, "archive", "releases", "v0.2", "ui", "preload.cjs"),
      contextIsolation: true, sandbox: true, nodeIntegration: false, webviewTag: false,
    },
  });
  window.setAlwaysOnTop(true, "floating");
  window.setContentProtection(true);
  window.setMenuBarVisibility(false);
  window.webContents.setWindowOpenHandler(({ url }) => { if (url.startsWith("https://")) void shell.openExternal(url); return { action: "deny" }; });
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  void window.loadFile(path.join(config.applicationRoot, "archive", "releases", "v0.2", "ui", "index.html"));
  window.once("ready-to-show", () => window.show());
  return window;
}

async function bootstrap(): Promise<void> {
  const contracts = await createObservationContracts(config.contractsDirectory);
  const store = new ObservationStateStore(config.dataDirectory, contracts);
  const settings = await store.loadSettings(config.settings);
  const service = await KovacsService.create(config.coaching);
  controller = new ObservationController(service, store, settings, new WindowsActiveWindowProbe(), new ElectronWindowCapture());
  await controller.initialize();
  pet = createPet();
  controller.onUpdate((update) => pet?.webContents.send("ambient:update", update));

  ipcMain.handle("ambient:bootstrap", () => ({ state: controller.getState(), settings, platform: process.platform, defaultProject: config.applicationRoot }));
  ipcMain.handle("ambient:start", async (_event, payload: unknown) => {
    if (!payload || typeof payload !== "object") throw new Error("Invalid Start Day payload.");
    const input = payload as Record<string, unknown>;
    return controller.startDay(cleanText(input.project, "Project", 2048), cleanText(input.objective, "Objective", 1000));
  });
  ipcMain.handle("ambient:status", async (_event, payload: unknown) => {
    const status = (payload as { status?: unknown } | null)?.status;
    if (status !== "observing" && status !== "paused" && status !== "private") throw new Error("Invalid observation status.");
    return controller.setStatus(status as Extract<AmbientStatus, "observing" | "paused" | "private">);
  });
  ipcMain.handle("ambient:observe", () => controller.observeNow());
  ipcMain.handle("ambient:end", () => controller.endDay());
  ipcMain.handle("ambient:close", async () => {
    const state = controller.getState();
    if (state && state.status !== "ended" && state.status !== "paused") await controller.setStatus("paused");
    pet?.close();
  });

  interval = setInterval(() => { void controller.tick().catch((error: unknown) => pet?.webContents.send("ambient:update", { state: controller.getState(), message: `Observation failed safely: ${(error as Error).message}` })); }, settings.sample_interval_ms);
  globalShortcut.register("CommandOrControl+Alt+K", () => {
    const state = controller.getState();
    if (!state || state.status === "ended") return;
    void controller.setStatus(state.status === "observing" ? "paused" : "observing");
  });
}

app.whenReady().then(bootstrap).catch((error: unknown) => { console.error(`Kovacs pet failed: ${(error as Error).message}`); app.quit(); });
app.on("second-instance", () => { pet?.show(); pet?.focus(); });
app.on("before-quit", () => { if (interval) clearInterval(interval); globalShortcut.unregisterAll(); });
app.on("window-all-closed", () => app.quit());
