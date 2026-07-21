import { app, BrowserWindow, dialog, globalShortcut, ipcMain, shell } from "electron";
import path from "node:path";
import { KovacsService } from "../../v01/service.js";
import { createAmbientContracts } from "../../v02/contracts.js";
import { AmbientController } from "../../v02/controller.js";
import { AmbientStateStore } from "../../v02/state-store.js";
import type { AmbientStatus } from "../../v02/types.js";
import { ElectronWindowCapture, WindowsActiveWindowProbe } from "../../v02/electron/adapters.js";
import { LocalContextEngine } from "../../v032/context-engine.js";
import { PerceptionCascade } from "../../v032/perception-cascade.js";
import { WindowsPerception } from "../../v032/windows-perception.js";
import { LocalSensitiveContentGuard } from "../../v033/sensitive-content.js";
import type { ContextFrame } from "../types.js";
import { loadV03Config } from "../config.js";
import { createV03Contracts } from "../contracts.js";
import { V03Controller } from "../controller.js";
import { CodexV03Planner } from "../planner.js";
import { V03Store } from "../store.js";
import { CHECKPOINT_STATUSES, DAY_OUTCOMES, EVIDENCE_SOURCES, INTERVENTION_FEEDBACK_KINDS } from "../types.js";

if (process.platform !== "win32") throw new Error("Kovacs V0.3.3 pet currently supports Windows only.");
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

function textList(value: unknown, label: string, maximumItems = 20): string[] {
  if (!Array.isArray(value) || value.length > maximumItems) throw new Error(`${label} must be an array with at most ${maximumItems} items.`);
  return value.map((item, index) => text(item, `${label} ${index + 1}`, 500));
}

function createPet(): BrowserWindow {
  const window = new BrowserWindow({
    width: 460, height: 780, minWidth: 390, minHeight: 600, show: false, frame: false, transparent: true,
    alwaysOnTop: true, resizable: true, maximizable: false, fullscreenable: false, skipTaskbar: false,
    backgroundColor: "#00000000", title: "Kovacs V0.3.3",
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
  const contextEngine = new LocalContextEngine();
  const perception = new WindowsPerception(path.join(config.applicationRoot, "scripts"));
  const perceptionCascade = new PerceptionCascade(perception, contextEngine, new LocalSensitiveContentGuard(config.restrictedTerms));
  let lastContext: ContextFrame | null = null;
  const workingFrames = new Map<string, { frame: ContextFrame; observedAt: number }>();
  const retrievalByContext = new Map<string, { query: string; project: string | null; results: ReturnType<V03Store["searchMemories"]>; observedAt: number }>();
  let operating: V03Controller;
  const ambient = new AmbientController(service, ambientStore, settings, new WindowsActiveWindowProbe(), new ElectronWindowCapture(), {
    operatingContext: () => operating?.contextSummary() ?? "",
    localPerception: async (window, capture) => {
      const day = store?.getActiveDay() ?? null;
      const result = await perceptionCascade.observe({ window, project: day?.project ?? null,
        activeCheckpoint: day?.checkpoints.find((item) => item.status === "active")?.title ?? null,
        previous: lastContext, capture });
      const cutoff = Date.now() - 10 * 60_000;
      for (const [contextId, entry] of workingFrames) if (entry.observedAt < cutoff) workingFrames.delete(contextId);
      for (const [contextId, entry] of retrievalByContext) if (entry.observedAt < cutoff) retrievalByContext.delete(contextId);
      workingFrames.set(result.frame.context_id, { frame: result.frame, observedAt: Date.now() });
      lastContext = result.frame;
      const query = `${result.frame.activity} ${result.frame.visible_intent} ${result.frame.artifact ?? ""} ${day?.objective ?? ""}`;
      const memories = store?.searchMemories({ text: query, project: day?.project ?? null,
        kinds: ["routine", "context", "pattern", "lesson"], maximum_sensitivity: "internal", limit: 3 }) ?? [];
      retrievalByContext.set(result.frame.context_id, { query, project: day?.project ?? null, results: memories, observedAt: Date.now() });
      return { context: `${contextEngine.summarize(result.frame, memories)}\nPerception path: ${result.capture_used ? result.screenshot ? "UIA -> OCR -> screenshot" : "UIA -> OCR" : "UIA only"}${result.failures.length ? `\nLocal perception limitations: ${result.failures.join(" | ")}` : ""}`,
        context_id: result.frame.context_id, occurred_at: result.frame.occurred_at,
        fingerprint: result.fingerprint, semantic_fingerprint: result.semantic_fingerprint,
        confidence: result.frame.confidence, sufficient: contextEngine.isSufficient(result.frame), conflicting: result.conflicting,
        deterministic_trigger: result.deterministic_trigger, prompt_injection_detected: result.prompt_injection_detected,
        sensitive_content_detected: result.sensitive_content_detected, sensitive_categories: result.sensitive_categories,
        screenshot_blocked_reason: result.screenshot_blocked_reason, changed_fields: result.frame.changed_fields,
        screenshot: result.screenshot, capture_used: result.capture_used, ocr_used: result.ocr_used };
    },
    onContextDecision: (decision) => {
      store?.recordContextDecision(decision);
      const retrieval = retrievalByContext.get(decision.context_id);
      if (retrieval && decision.reason !== "unchanged") store?.recordRetrievalDiagnostic(decision.context_id, retrieval.project, retrieval.query, retrieval.results);
    },
    onContextEvent: (event) => {
      const entry = workingFrames.get(event.context_id);
      if (entry && Date.now() - entry.observedAt <= 10 * 60_000) store?.recordContextFrame(entry.frame, event);
    },
    onWorkingContextCleared: () => { workingFrames.clear(); retrievalByContext.clear(); lastContext = null; },
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
    return controller.draftSetup({ narrative: text(input.narrative, "Your situation", 6000) });
  });
  ipcMain.handle("v03:setup:confirm", (_event, value: unknown) => controller.confirmSetup(text(payload(value, "setup confirmation").draft_id, "Draft identifier", 100)));
  ipcMain.handle("v03:setup:revise", (_event, value: unknown) => { const input = payload(value, "setup revision"); return controller.reviseSetupDraft(text(input.draft_id, "Draft identifier", 100), payload(input.proposal, "setup proposal") as never, text(input.reason, "Revision reason", 1000)); });
  ipcMain.handle("v03:setup:correct", (_event, value: unknown) => {
    const input = payload(value, "calibration correction"), values = payload(input.values ?? {}, "calibration values");
    const corrected: Record<string, unknown> = {};
    if (values.current_position !== undefined) corrected.current_position = text(values.current_position, "Current position", 1000);
    if (values.available_hours_per_week !== undefined) corrected.available_hours_per_week = Number(values.available_hours_per_week);
    if (values.active_projects !== undefined) corrected.active_projects = textList(values.active_projects, "Active projects");
    if (values.growth_edges !== undefined) corrected.growth_edges = textList(values.growth_edges, "Growth edges");
    if (values.desired_outcome !== undefined) corrected.desired_outcome = text(values.desired_outcome, "Desired outcome", 2000);
    return controller.correctSetupDraft(text(input.draft_id, "Draft identifier", 100), { values: corrected,
      accepted_unknowns: textList(input.accepted_unknowns ?? [], "Accepted unknowns", 5) as never,
      reason: text(input.reason, "Correction reason", 1000) });
  });
  ipcMain.handle("v03:setup:refine", (_event, value: unknown) => {
    const input = payload(value, "calibration refinement");
    if (!Array.isArray(input.answers) || input.answers.length < 1 || input.answers.length > 2) throw new Error("One or two clarification answers are required.");
    const answers = input.answers.map((item, index) => { const answer = payload(item, `clarification answer ${index + 1}`); return {
      question: text(answer.question, "Clarification question", 1000), answer: text(answer.answer, "Clarification answer", 2000) }; });
    return controller.refineSetupDraft(text(input.draft_id, "Draft identifier", 100), answers);
  });
  ipcMain.handle("v03:week:draft", (_event, value: unknown) => {
    const input = payload(value, "week");
    return controller.draftWeek({ priorities: text(input.priorities, "Weekly priorities", 2000), constraints: text(input.constraints, "Weekly constraints", 2000) });
  });
  ipcMain.handle("v03:week:confirm", (_event, value: unknown) => controller.confirmWeek(text(payload(value, "week confirmation").draft_id, "Draft identifier", 100)));
  ipcMain.handle("v03:week:revise", (_event, value: unknown) => { const input = payload(value, "week revision"); return controller.reviseWeekDraft(text(input.draft_id, "Draft identifier", 100), payload(input.proposal, "week proposal") as never, text(input.reason, "Revision reason", 1000)); });
  ipcMain.handle("v03:day:draft", (_event, value: unknown) => {
    const input = payload(value, "day");
    return controller.draftDay(text(input.project, "Project", 2048), text(input.objective, "Objective", 1000));
  });
  ipcMain.handle("v03:day:confirm", (_event, value: unknown) => controller.confirmDay(text(payload(value, "day confirmation").draft_id, "Draft identifier", 100)));
  ipcMain.handle("v03:draft:reject", (_event, value: unknown) => { const input = payload(value, "draft rejection"); return controller.rejectDraft(text(input.draft_id, "Draft identifier", 100), text(input.reason, "Rejection reason", 1000)); });
  ipcMain.handle("v03:day:draft:revise", (_event, value: unknown) => { const input = payload(value, "draft revision"); return controller.reviseDayDraft(text(input.draft_id, "Draft identifier", 100), payload(input.proposal, "day proposal") as never, text(input.reason, "Revision reason", 1000)); });
  ipcMain.handle("v03:day:objective", (_event, value: unknown) => { const input = payload(value, "objective revision"); return controller.reviseActiveObjective({ objective: text(input.objective, "Objective", 1000), reason: text(input.reason, "Revision reason", 1000) }); });
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
    const source = input.evidence_source ?? "self_reported";
    if (!EVIDENCE_SOURCES.includes(source as never) || source === "observed" || source === "reviewed") throw new Error("Invalid evidence source.");
    return controller.completeCheckpoint({ checkpoint_id: text(input.checkpoint_id, "Checkpoint identifier", 100), outcome, result: text(input.result, "Result", 2000), validation: text(input.validation, "Validation", 2000), assistance_level: assistance as "A0" | "A1" | "A2" | "A3" | "A4" | "A5", evidence_source: source as "self_reported" | "tool_verified" | "artifact_verified" });
  });
  ipcMain.handle("v03:checkpoint:transition", (_event, value: unknown) => { const input = payload(value, "checkpoint transition"); const status = input.status; if (!CHECKPOINT_STATUSES.includes(status as never) || status === "pending" || status === "completed") throw new Error("Invalid checkpoint transition."); return controller.transitionCheckpoint({ checkpoint_id: text(input.checkpoint_id, "Checkpoint identifier", 100), status: status as "active" | "blocked" | "deferred" | "abandoned", reason: text(input.reason, "Checkpoint reason", 1000) }); });
  ipcMain.handle("v03:day:end", (_event, value: unknown) => {
    const input = payload(value, "end day");
    if (!DAY_OUTCOMES.includes(input.outcome as never)) throw new Error("Invalid day outcome.");
    const source = input.evidence_source ?? "self_reported";
    if (source !== "self_reported" && source !== "tool_verified" && source !== "artifact_verified") throw new Error("Invalid evidence source.");
    return controller.endDay({ outcome: input.outcome as (typeof DAY_OUTCOMES)[number], output_summary: text(input.output_summary, "Output summary", 3000), validation_summary: text(input.validation_summary, "Validation summary", 3000), lesson: text(input.lesson, "Lesson", 2000), evidence_source: source });
  });
  ipcMain.handle("v03:day:end:draft", (_event, value: unknown) => controller.draftEndDay(text(payload(value, "end day narrative").narrative, "What happened today", 6000)));
  ipcMain.handle("v03:day:end:confirm", (_event, value: unknown) => controller.confirmEndDay(text(payload(value, "end day confirmation").draft_id, "Draft identifier", 100)));
  ipcMain.handle("v03:day:end:reject", (_event, value: unknown) => { const input = payload(value, "end day rejection"); return controller.rejectEndDayDraft(text(input.draft_id, "Draft identifier", 100), text(input.reason, "Rejection reason", 1000)); });
  ipcMain.handle("v03:memory:status", (_event, value: unknown) => { const input = payload(value, "memory status"); const status = input.status; if (status !== "active" && status !== "pending_confirmation") throw new Error("Invalid memory status."); return controller.setMemoryStatus(text(input.memory_id, "Memory identifier", 100), status); });
  ipcMain.handle("v03:memory:pin", (_event, value: unknown) => { const input = payload(value, "memory pin"); if (typeof input.pinned !== "boolean") throw new Error("Invalid pinned value."); return controller.setMemoryPinned(text(input.memory_id, "Memory identifier", 100), input.pinned); });
  ipcMain.handle("v03:memory:delete", (_event, value: unknown) => controller.deleteMemory(text(payload(value, "memory delete").memory_id, "Memory identifier", 100)));
  ipcMain.handle("v03:evidence:review", (_event, value: unknown) => controller.reviewEvidence(text(payload(value, "evidence review").evidence_id, "Evidence identifier", 100)));
  ipcMain.handle("v03:memory:delete-day", (_event, value: unknown) => controller.deleteMemoriesByDay(text(payload(value, "day memory delete").day_id, "Day identifier", 100)));
  ipcMain.handle("v03:memory:delete-session", (_event, value: unknown) => controller.deleteMemoriesBySession(text(payload(value, "session memory delete").session_id, "Session identifier", 100)));
  ipcMain.handle("v03:retention", (_event, value: unknown) => { const input = payload(value, "retention"); const memoryDays = input.memory_days === null ? null : Number(input.memory_days); return controller.setRetentionPolicy(memoryDays, Number(input.sensitive_days)); });
  ipcMain.handle("v03:feedback", (_event, value: unknown) => { const input = payload(value, "feedback"); if (!INTERVENTION_FEEDBACK_KINDS.includes(input.kind as never)) throw new Error("Invalid feedback kind."); return controller.addInterventionFeedback(text(input.request_id, "Request identifier", 100), input.kind as (typeof INTERVENTION_FEEDBACK_KINDS)[number], typeof input.note === "string" ? input.note.slice(0, 1000) : undefined); });
  ipcMain.handle("v03:backup", () => controller.createBackup(path.join(app.getPath("documents"), "Kovacs Backups")));
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

app.whenReady().then(bootstrap).catch((error: unknown) => {
  const message = (error as Error).message;
  console.error(`Kovacs pet failed: ${message}`);
  dialog.showErrorBox("Kovacs could not start safely", `${message}\n\nNo database was deleted or rebuilt. Restore a user-created backup or run npm run v032:validate before retrying.`);
  app.quit();
});
app.on("second-instance", () => { pet?.show(); pet?.focus(); });
app.on("before-quit", () => { if (interval) clearInterval(interval); globalShortcut.unregisterAll(); store?.close(); });
app.on("window-all-closed", () => app.quit());
