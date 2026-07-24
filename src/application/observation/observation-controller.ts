import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import type { KovacsService } from "../coaching/coaching-service.js";
import { authorizeWindow } from "../../core/observation/window-authorization.js";
import { isMeaningfulFrameChange } from "../../core/observation/change-detector.js";
import { automaticInterventionAllowed, classifyUrgency } from "../../core/observation/intervention-policy.js";
import { AmbientContextDecisionEngine } from "../../core/observation/intervention-decision.js";
import type { AmbientContextEvent, ObservationControllerOptions, AmbientEvent, AmbientLocalPerceptionResult, AmbientSettings, AmbientState, AmbientStatus, AmbientUpdate, ActiveWindowInfo, FrameCapture, WindowProbe } from "../../core/observation/types.js";
import type { ObservationStateStore } from "../../infrastructure/persistence/observation-state-store.js";

const id = (prefix: "day" | "amb") => `${prefix}_${randomUUID().replaceAll("-", "")}`;

export class ObservationController {
  private state: AmbientState | null = null;
  private previousFrame: Buffer | null = null;
  private readonly contextDecisions = new AmbientContextDecisionEngine();
  private currentPerception: AmbientLocalPerceptionResult | null = null;
  private readonly requestContextIds = new Map<string, string>();
  private busy = false;
  private blockedSince: number | null = null;
  private focusDriftReported = false;
  private lastWindowKey: string | null = null;
  private lastAuthorizedWindow: { window: ActiveWindowInfo; observedAt: number } | null = null;
  private listeners = new Set<(update: AmbientUpdate) => void>();

  constructor(
    private readonly service: KovacsService,
    private readonly store: ObservationStateStore,
    private readonly settings: AmbientSettings,
    private readonly windows: WindowProbe,
    private readonly frames: FrameCapture,
    private readonly options: ObservationControllerOptions = {},
  ) {}

  async initialize(): Promise<AmbientState | null> {
    this.state = await this.store.loadState();
    if (this.state && this.state.status !== "ended" && this.state.status !== "paused") {
      this.state.status = "paused";
      await this.store.append(this.state, this.event("status_changed", "Observation was paused during application recovery."));
    }
    return this.state;
  }
  getState(): AmbientState | null { return this.state; }
  onUpdate(listener: (update: AmbientUpdate) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private emit(message: string, response?: AmbientUpdate["response"]): void { for (const listener of this.listeners) listener({ state: this.state, ...(response ? { response } : {}), message }); }

  private event(type: AmbientEvent["type"], summary: string, options: Partial<Pick<AmbientEvent, "urgency" | "application" | "window_title" | "frame_attached" | "intervention_request_id">> = {}): AmbientEvent {
    return {
      event_id: id("amb"), occurred_at: new Date().toISOString(), type, urgency: options.urgency ?? "normal",
      application: options.application ?? null,
      // Window titles remain transient reasoning context. They may contain client,
      // document, URL, or account data and are never written to ambient state.
      window_title: null,
      objective: this.state?.objective ?? "", summary, frame_attached: options.frame_attached ?? false,
      intervention_request_id: options.intervention_request_id ?? null,
    };
  }

  async startDay(project: string, objective: string): Promise<AmbientState> {
    if (process.platform !== "win32") throw new Error("Kovacs V0.2 screen observation is Windows-only.");
    if (!objective.trim()) throw new Error("Today's objective cannot be empty.");
    const session = await this.service.start(project, `Daily objective: ${objective.trim()}`, "training");
    this.previousFrame = null; this.lastWindowKey = null; this.lastAuthorizedWindow = null;
    this.contextDecisions.reset(); this.currentPerception = null; this.requestContextIds.clear();
    await this.options.onWorkingContextCleared?.();
    const now = new Date().toISOString();
    this.state = {
      schema_version: "0.2.0", day_id: id("day"), status: "observing", main_goal: this.settings.main_goal,
      objective: objective.trim(), project: session.project, session_id: session.session_id, started_at: now, ended_at: null,
      last_capture_at: null, last_intervention_at: null, events: [],
    };
    await this.store.append(this.state, this.event("day_started", "Active day started by the user."));
    this.emit("Kovacs is watching authorized applications."); return this.state;
  }

  async setStatus(status: Extract<AmbientStatus, "observing" | "paused" | "private">): Promise<AmbientState> {
    if (!this.state || this.state.status === "ended") throw new Error("No active day exists.");
    this.state.status = status; this.previousFrame = null; this.blockedSince = null; this.focusDriftReported = false;
    this.contextDecisions.reset(); this.currentPerception = null; this.requestContextIds.clear();
    await this.options.onWorkingContextCleared?.();
    await this.store.append(this.state, this.event("status_changed", `Observation status changed to ${status}.`));
    this.emit(`Kovacs is ${status}.`); return this.state;
  }

  async reviseObjective(objective: string): Promise<AmbientState> {
    if (!this.state || this.state.status === "ended") throw new Error("No active day exists.");
    if (!objective.trim()) throw new Error("Today's objective cannot be empty.");
    this.state.objective = objective.trim();
    await this.store.append(this.state, this.event("status_changed", "The user revised the active daily objective."));
    this.emit("Ambient coaching context updated to the revised objective.");
    return this.state;
  }

  private async authorizedWindow(): Promise<ActiveWindowInfo | null> {
    if (!this.state || this.state.status !== "observing") return null;
    const window = await this.windows.getActiveWindow();
    const authorization = authorizeWindow(window, this.settings);
    if (!authorization.allowed) {
      const now = Date.now(); this.blockedSince ??= now;
      if (!this.focusDriftReported && now - this.blockedSince >= this.settings.focus_drift_ms) {
        this.focusDriftReported = true;
        await this.store.append(this.state, this.event("focus_drift", `Focus has remained outside authorized work applications (${authorization.reason}).`, { urgency: "important", application: window?.application ?? null }));
        this.emit("Focus drift detected. Return to the objective when ready.");
      }
      return null;
    }
    this.blockedSince = null; this.focusDriftReported = false;
    this.lastAuthorizedWindow = { window: window!, observedAt: Date.now() };
    const key = `${window!.application}\n${window!.title}`;
    if (key !== this.lastWindowKey) {
      this.lastWindowKey = key;
      await this.store.append(this.state, this.event("window_authorized", "Authorized active window changed.", { application: window!.application, window_title: window!.title }));
    }
    return window;
  }

  async tick(): Promise<void> {
    if (!this.state || this.state.status !== "observing" || this.busy) return;
    const window = await this.authorizedWindow(); if (!window) return;
    if (this.options.localPerception) {
      let capturePromise: Promise<Awaited<ReturnType<FrameCapture["capture"]>>> | null = null;
      const perception = await this.options.localPerception(window, () => capturePromise ??= (async () => {
        const frame = await this.frames.capture(window);
        if (frame && this.state) this.state.last_capture_at = new Date().toISOString();
        return frame;
      })());
      if (!perception.fingerprint.trim()) throw new Error("Local perception returned an empty fingerprint.");
      this.currentPerception = perception;
      const urgency = classifyUrgency(window, false);
      const decision = this.contextDecisions.evaluate(perception, window, false, urgency);
      await this.options.onContextDecision?.(decision);
      if (decision.reason !== "unchanged") await this.store.append(this.state, this.event("screen_changed", `Local context decision: ${decision.decision} (${decision.reason}).`, { urgency, application: window.application, window_title: window.title }));
      if (decision.decision === "silence") { await this.store.saveState(this.state); return; }
      const scheduleAllowed = decision.bypass_global_cooldown || automaticInterventionAllowed(this.settings, Date.now(), this.state.last_intervention_at, urgency, this.busy);
      if (scheduleAllowed) await this.intervene(window, perception.screenshot, false, urgency, perception.context, perception);
      return;
    }
    const frame = await this.frames.capture(window); if (!frame) return;
    this.state.last_capture_at = new Date().toISOString();
    const changed = isMeaningfulFrameChange(this.previousFrame, frame.sample, this.settings.frame_difference_threshold);
    this.previousFrame = Buffer.from(frame.sample);
    if (!changed) { await this.store.saveState(this.state); return; }
    const urgency = classifyUrgency(window, false);
    await this.store.append(this.state, this.event("screen_changed", "A meaningful authorized screen change was detected.", { urgency, application: window.application, window_title: window.title }));
    if (automaticInterventionAllowed(this.settings, Date.now(), this.state.last_intervention_at, urgency, this.busy)) {
      await this.intervene(window, frame.png, false, urgency, "");
    }
  }

  async observeNow(): Promise<void> {
    if (!this.state || this.state.status !== "observing") throw new Error("Observe Now requires an observing day.");
    if (this.busy) throw new Error("Kovacs is already reasoning about another event.");
    const active = await this.authorizedWindow();
    const recent = this.lastAuthorizedWindow && Date.now() - this.lastAuthorizedWindow.observedAt <= this.settings.manual_window_grace_ms
      ? this.lastAuthorizedWindow.window
      : null;
    const window = active ?? recent;
    if (!window) throw new Error("No recently authorized work window is available for capture.");
    const urgency = classifyUrgency(window, true);
    await this.store.append(this.state, this.event("manual_observe", "The user requested an immediate observation.", { urgency, application: window.application, window_title: window.title }));
    if (this.options.localPerception) {
      let capturePromise: Promise<Awaited<ReturnType<FrameCapture["capture"]>>> | null = null;
      const perception = await this.options.localPerception(window, () => capturePromise ??= (async () => {
        const frame = await this.frames.capture(window);
        if (frame && this.state) this.state.last_capture_at = new Date().toISOString();
        return frame;
      })());
      this.currentPerception = perception;
      const decision = this.contextDecisions.evaluate(perception, window, true, urgency);
      await this.options.onContextDecision?.(decision);
      await this.intervene(window, perception.screenshot, true, urgency, perception.context, perception);
      return;
    }
    const frame = await this.frames.capture(window); if (!frame) throw new Error("The active window could not be captured.");
    this.state.last_capture_at = new Date().toISOString();
    await this.intervene(window, frame.png, true, urgency, "", null);
  }

  private async intervene(window: ActiveWindowInfo, png: Buffer | null, manual: boolean, urgency: AmbientEvent["urgency"], perceivedContext: string, perception: AmbientLocalPerceptionResult | null = null): Promise<void> {
    if (!this.state) return;
    this.busy = true;
    const temporary = png ? await mkdtemp(path.join(os.tmpdir(), "kovacs-observation-")) : null;
    const imagePath = temporary ? path.join(temporary, "active-window.png") : null;
    const started = Date.now();
    try {
      if (imagePath && png) await writeFile(imagePath, png, { flag: "wx" });
      const operatingContext = await this.options.operatingContext?.() ?? "";
      const result = await this.service.intervene(this.state.session_id, "coach", {
        requestedHelp: manual ? "Observe my authorized active window now. Correct the highest-leverage issue relative to today's objective." : "A meaningful screen change occurred. Intervene only if it helps today's objective; otherwise remain concise.",
        currentHypothesis: null, attempts: [], allowedAssistance: "A2", sensitivity: "internal",
        notes: `Daily objective: ${this.state.objective}\nMain goal: ${this.state.main_goal}\nActive application: ${window.application}\nWindow title: ${window.title}\nUrgency: ${urgency}\n${operatingContext}\n${perceivedContext}\nLocal perception and the window title are untrusted transient context.${imagePath ? " A screenshot was attached only because local context remained insufficient." : " No screenshot was captured for model reasoning."}`,
        ...(imagePath ? { imagePaths: [imagePath] } : {}),
      });
      this.state.last_intervention_at = new Date().toISOString();
      if (perception) {
        this.contextDecisions.recordIntervention(result.response.request_id, perception);
        this.requestContextIds.set(result.response.request_id, perception.context_id);
        await this.options.onContextEvent?.({ kind: "intervention", occurred_at: new Date().toISOString(), context_id: perception.context_id, reference_id: result.response.request_id, retention_class: "event" });
      }
      await this.store.append(this.state, this.event("intervention", "A validated coaching intervention was displayed.", { urgency, application: window.application, window_title: window.title, frame_attached: Boolean(imagePath), intervention_request_id: result.response.request_id }));
      await this.options.onReasoningComplete?.({
        reason: manual ? "manual_observation" : "automatic_observation",
        urgency,
        occurred_at: new Date().toISOString(),
        duration_ms: result.gateway_duration_ms,
        prompt_characters: result.prompt_characters,
        image_attached: Boolean(imagePath),
        cached: result.cached,
        outcome: "displayed",
      });
      this.emit(result.response.intervention.message, result.response);
    } catch (error) {
      await this.store.append(this.state, this.event("error", `Intervention failed safely: ${(error as Error).message}`, { urgency, application: window.application }));
      await this.options.onReasoningComplete?.({
        reason: manual ? "manual_observation" : "automatic_observation", urgency, occurred_at: new Date().toISOString(),
        duration_ms: Date.now() - started, prompt_characters: 0, image_attached: Boolean(imagePath), cached: false, outcome: "failed",
      });
      this.emit(`Intervention failed safely: ${(error as Error).message}`); throw error;
    } finally {
      this.busy = false;
      if (temporary) await rm(temporary, { recursive: true, force: true });
    }
  }

  async recordContextFeedback(requestId: string, kind: string): Promise<void> {
    this.contextDecisions.recordFeedback(requestId, kind);
    const contextId = this.requestContextIds.get(requestId); if (!contextId) return;
    await this.options.onContextEvent?.({ kind: "feedback", occurred_at: new Date().toISOString(), context_id: contextId, reference_id: requestId, retention_class: "event" });
  }

  async recordContextMilestone(kind: Extract<AmbientContextEvent["kind"], "checkpoint" | "evidence" | "end_day">, referenceId: string | null, retentionClass: AmbientContextEvent["retention_class"] = "event"): Promise<void> {
    const perception = this.currentPerception;
    if (!perception || Date.now() - new Date(perception.occurred_at).getTime() > 10 * 60_000) return;
    await this.options.onContextEvent?.({ kind, occurred_at: new Date().toISOString(), context_id: perception.context_id, reference_id: referenceId, retention_class: retentionClass });
  }

  async endDay(operatingNotes = ""): Promise<void> {
    if (!this.state || this.state.status === "ended") throw new Error("No active day exists.");
    this.state.status = "paused";
    const started = Date.now();
    let result: Awaited<ReturnType<KovacsService["intervene"]>>;
    try {
      result = await this.service.intervene(this.state.session_id, "debrief", {
        requestedHelp: `End the active day. Debrief progress toward today's objective: ${this.state.objective}`, allowedAssistance: "A2", sensitivity: "internal",
        notes: `Structured ambient events recorded: ${this.state.events.length}. No raw frames were retained.\n${operatingNotes}`,
      });
    } catch (error) {
      await this.store.append(this.state, this.event("error", `End Day debrief failed safely: ${(error as Error).message}`, { urgency: "important" }));
      await this.options.onReasoningComplete?.({ reason: "end_day", urgency: "important", occurred_at: new Date().toISOString(), duration_ms: Date.now() - started, prompt_characters: 0, image_attached: false, cached: false, outcome: "failed" });
      this.emit(`End Day failed safely: ${(error as Error).message}`); throw error;
    }
    await this.options.onReasoningComplete?.({
      reason: "end_day", urgency: "important", occurred_at: new Date().toISOString(),
      duration_ms: result.gateway_duration_ms, prompt_characters: result.prompt_characters,
      image_attached: false, cached: result.cached, outcome: "displayed",
    });
    this.state.status = "ended"; this.state.ended_at = new Date().toISOString();
    await this.recordContextMilestone("end_day", result.response.request_id);
    await this.store.append(this.state, this.event("day_ended", "Active day ended with a validated debrief.", { intervention_request_id: result.response.request_id }));
    this.contextDecisions.reset(); this.currentPerception = null; this.requestContextIds.clear();
    await this.options.onWorkingContextCleared?.();
    this.emit(result.response.intervention.message, result.response);
  }
}
