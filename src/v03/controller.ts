import { realpath, stat } from "node:fs/promises";
import path from "node:path";
import type { ProfileResponse } from "../v01/types.js";
import type { AmbientController } from "../v02/controller.js";
import type { AmbientReasoningTelemetry, AmbientState, AmbientStatus } from "../v02/types.js";
import type { V03Store } from "./store.js";
import type {
  CheckpointCompletionInput,
  CheckpointTransitionInput,
  DayProposal,
  EndDayInput,
  InterventionFeedbackKind,
  MemoryStatus,
  OperatingSnapshot,
  ObjectiveRevisionInput,
  SetupInput,
  SetupProposal,
  V03Planner,
  V03Update,
  WeekInput,
  WeekProposal,
} from "./types.js";

const MAIN_GOAL = "Become an Elite AI Systems Staff Engineer, using OpenAI as the benchmark of engineering efficiency, judgment, and impact.";

function clean(value: unknown, label: string, maximum: number): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maximum) throw new Error(`${label} must be between 1 and ${maximum} characters.`);
  return value.trim();
}

export class V03Controller {
  private listeners = new Set<(update: V03Update) => void>();
  private planning = false;

  constructor(private readonly ambient: AmbientController, private readonly store: V03Store, private readonly planner: V03Planner) {
    this.ambient.onUpdate((update) => {
      if (update.response?.memory_candidates.length) {
        const ambient = this.ambient.getState();
        this.store.ingestMemoryCandidates(update.response.memory_candidates, this.store.getActiveDay()?.day_id ?? null, ambient?.session_id ?? null);
      }
      this.emit(update.message, update.response);
    });
  }

  async initialize(): Promise<OperatingSnapshot> {
    await this.ambient.initialize();
    return this.store.snapshot();
  }

  onUpdate(listener: (update: V03Update) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  getAmbientState(): AmbientState | null { return this.ambient.getState(); }
  snapshot(): OperatingSnapshot { return this.store.snapshot(); }
  contextSummary(): string { return this.store.contextSummary(); }

  private emit(message: string, response?: ProfileResponse): void {
    const update: V03Update = { ambient: this.ambient.getState(), operating: this.store.snapshot(), message, ...(response ? { response } : {}) };
    for (const listener of this.listeners) listener(update);
  }

  private async exclusive<T>(operation: () => Promise<T>): Promise<T> {
    if (this.planning) throw new Error("Kovacs is already preparing another plan.");
    this.planning = true;
    try { return await operation(); } finally { this.planning = false; }
  }

  async draftSetup(raw: SetupInput): Promise<OperatingSnapshot> {
    if (this.store.getProfile()) throw new Error("The operating system is already configured. Start a new week instead.");
    const input: SetupInput = {
      current_position: clean(raw.current_position, "Current position", 1000),
      available_hours_per_week: Number(raw.available_hours_per_week),
      active_projects: clean(raw.active_projects, "Active projects", 2000),
      weaknesses: clean(raw.weaknesses, "Growth edges", 2000),
      desired_outcome: clean(raw.desired_outcome, "Desired outcome", 2000),
    };
    if (!Number.isFinite(input.available_hours_per_week) || input.available_hours_per_week < 1 || input.available_hours_per_week > 100) throw new Error("Available hours must be between 1 and 100 per week.");
    return this.exclusive(async () => {
      const started = Date.now();
      const invocationId = this.store.beginInvocation({ day_id: null, reason: "draft_90_day_mission", urgency: "important", image_attached: false });
      try {
        const execution = await this.planner.draftSetup(input, MAIN_GOAL);
        this.store.finishInvocation(invocationId, { duration_ms: execution.duration_ms, prompt_characters: execution.prompt_characters, response_characters: JSON.stringify(execution.proposal).length, cached: false, outcome: "proposal", response_used: true });
        this.store.saveSetupDraft(input, execution.proposal);
        this.emit("90-day mission and first week drafted. Confirm them before they become durable.");
        return this.store.snapshot();
      } catch (error) {
        this.store.finishInvocation(invocationId, { duration_ms: Date.now() - started, prompt_characters: 0, response_characters: 0, cached: false, outcome: "failed", response_used: false });
        throw error;
      }
    });
  }

  confirmSetup(draftId: string): OperatingSnapshot {
    this.store.confirmSetup(clean(draftId, "Draft identifier", 100), MAIN_GOAL);
    this.emit("V0.3 operating hierarchy approved. Competencies remain unverified until practice produces evidence.");
    return this.store.snapshot();
  }

  async draftWeek(raw: WeekInput): Promise<OperatingSnapshot> {
    const profile = this.store.getProfile(); if (!profile) throw new Error("Complete V0.3 setup first.");
    if (this.store.getActiveDay()) throw new Error("End the active day before changing the weekly outcome.");
    if (this.store.snapshot().pending_day) throw new Error("Reject or confirm the pending daily proposal before changing the week.");
    const input: WeekInput = { priorities: clean(raw.priorities, "Weekly priorities", 2000), constraints: clean(raw.constraints, "Weekly constraints", 2000) };
    return this.exclusive(async () => {
      const started = Date.now();
      const invocationId = this.store.beginInvocation({ day_id: null, reason: "draft_week", urgency: "important", image_attached: false });
      try {
        const execution = await this.planner.draftWeek(input, profile, this.store.contextSummary());
        this.store.finishInvocation(invocationId, { duration_ms: execution.duration_ms, prompt_characters: execution.prompt_characters, response_characters: JSON.stringify(execution.proposal).length, cached: false, outcome: "proposal", response_used: true });
        this.store.saveWeekDraft(input, execution.proposal);
        this.emit("The next rolling week is drafted and waiting for confirmation.");
        return this.store.snapshot();
      } catch (error) {
        this.store.finishInvocation(invocationId, { duration_ms: Date.now() - started, prompt_characters: 0, response_characters: 0, cached: false, outcome: "failed", response_used: false });
        throw error;
      }
    });
  }

  confirmWeek(draftId: string): OperatingSnapshot {
    this.store.confirmWeek(clean(draftId, "Draft identifier", 100));
    this.emit("New rolling week approved.");
    return this.store.snapshot();
  }

  async draftDay(projectInput: string, objectiveInput: string): Promise<OperatingSnapshot> {
    const profile = this.store.getProfile(); if (!profile) throw new Error("Complete V0.3 setup before drafting a day.");
    if (this.store.getActiveDay()) throw new Error("End the active day before drafting another one.");
    if (this.store.snapshot().pending_week) throw new Error("Confirm or reject the pending weekly proposal before drafting a day.");
    const project = await realpath(path.resolve(clean(projectInput, "Project", 2048)));
    if (!(await stat(project)).isDirectory()) throw new Error("Project must be an existing directory.");
    const objective = clean(objectiveInput, "Daily objective", 1000);
    return this.exclusive(async () => {
      const started = Date.now();
      const invocationId = this.store.beginInvocation({ day_id: null, reason: "draft_day", urgency: "important", image_attached: false });
      try {
        const execution = await this.planner.draftDay(project, objective, profile, this.store.contextSummary());
        this.store.finishInvocation(invocationId, { duration_ms: execution.duration_ms, prompt_characters: execution.prompt_characters, response_characters: JSON.stringify(execution.proposal).length, cached: false, outcome: "proposal", response_used: true });
        this.store.saveDayDraft(project, objective, execution.proposal);
        this.emit(execution.proposal.objective_changed ? "Kovacs challenged the objective. Review the proposed replacement before starting." : "Daily plan drafted. Confirm it to start observation.");
        return this.store.snapshot();
      } catch (error) {
        this.store.finishInvocation(invocationId, { duration_ms: Date.now() - started, prompt_characters: 0, response_characters: 0, cached: false, outcome: "failed", response_used: false });
        throw error;
      }
    });
  }

  async confirmDay(draftId: string): Promise<OperatingSnapshot> {
    const draft = this.store.snapshot().pending_day;
    if (!draft || draft.draft_id !== clean(draftId, "Draft identifier", 100) || !draft.project) throw new Error("The daily plan proposal no longer exists.");
    const ambient = await this.ambient.startDay(draft.project, draft.proposal.proposed_objective);
    try { this.store.startDay(draftId, ambient.day_id); }
    catch (error) { await this.ambient.setStatus("paused"); throw error; }
    this.emit("Daily plan approved. Kovacs is observing only authorized work windows.");
    return this.store.snapshot();
  }

  async setStatus(status: Extract<AmbientStatus, "observing" | "paused" | "private">): Promise<OperatingSnapshot> {
    await this.ambient.setStatus(status); return this.store.snapshot();
  }

  async observeNow(): Promise<void> { await this.ambient.observeNow(); }

  completeCheckpoint(input: CheckpointCompletionInput): OperatingSnapshot {
    clean(input.checkpoint_id, "Checkpoint identifier", 100);
    clean(input.result, "Checkpoint result", 2000);
    clean(input.validation, "Validation evidence", 2000);
    this.store.completeCheckpoint(input);
    this.emit("Checkpoint closed with structured evidence. The next checkpoint is now active.");
    return this.store.snapshot();
  }

  rejectDraft(draftId: string, reason: string): OperatingSnapshot {
    this.store.rejectDraft(clean(draftId, "Draft identifier", 100), clean(reason, "Rejection reason", 1000));
    this.emit("Proposal rejected. Nothing became active.");
    return this.store.snapshot();
  }

  reviseDayDraft(draftId: string, proposal: DayProposal, reason: string): OperatingSnapshot {
    this.store.reviseDayDraft(clean(draftId, "Draft identifier", 100), proposal, clean(reason, "Revision reason", 1000));
    this.emit("Daily proposal revised locally and still waiting for confirmation.");
    return this.store.snapshot();
  }

  reviseSetupDraft(draftId: string, proposal: SetupProposal, reason: string): OperatingSnapshot {
    this.store.reviseSetupDraft(clean(draftId, "Draft identifier", 100), proposal, clean(reason, "Revision reason", 1000));
    this.emit("Setup proposal revised locally and still waiting for confirmation."); return this.store.snapshot();
  }

  reviseWeekDraft(draftId: string, proposal: WeekProposal, reason: string): OperatingSnapshot {
    this.store.reviseWeekDraft(clean(draftId, "Draft identifier", 100), proposal, clean(reason, "Revision reason", 1000));
    this.emit("Weekly proposal revised locally and still waiting for confirmation."); return this.store.snapshot();
  }

  async reviseActiveObjective(input: ObjectiveRevisionInput): Promise<OperatingSnapshot> {
    const objective = clean(input.objective, "Objective", 1000);
    this.store.reviseActiveObjective(objective, clean(input.reason, "Revision reason", 1000));
    await this.ambient.reviseObjective(objective);
    this.emit("Daily objective revised with an audit trail. Observation remains under user control.");
    return this.store.snapshot();
  }

  transitionCheckpoint(input: CheckpointTransitionInput): OperatingSnapshot {
    this.store.transitionCheckpoint({ checkpoint_id: clean(input.checkpoint_id, "Checkpoint identifier", 100), status: input.status, reason: clean(input.reason, "Checkpoint reason", 1000) });
    this.emit(`Checkpoint marked ${input.status}.`);
    return this.store.snapshot();
  }

  async endDay(input: EndDayInput): Promise<OperatingSnapshot> {
    clean(input.output_summary, "Output summary", 3000);
    clean(input.validation_summary, "Validation summary", 3000);
    clean(input.lesson, "Lesson", 2000);
    const day = this.store.getActiveDay(); if (!day) throw new Error("No active V0.3 day exists.");
    const deterministicSummary = this.store.previewDaySummary(input);
    const notes = [
      `V0.3 outcome classification: ${input.outcome}`,
      `Concrete output: ${input.output_summary}`,
      `Validation: ${input.validation_summary}`,
      `Lesson: ${input.lesson}`,
      `Checkpoint progress: ${day.checkpoints.filter((item) => item.status === "completed").length}/${day.checkpoints.length}`,
      `Deterministic operating summary: ${JSON.stringify(deterministicSummary)}`,
    ].join("\n");
    await this.ambient.endDay(notes);
    this.store.endDay(input);
    this.emit("Day closed. Evidence, lesson, and competency state were updated; observation is stopped.");
    return this.store.snapshot();
  }

  setMemoryStatus(memoryId: string, status: MemoryStatus): OperatingSnapshot { this.store.setMemoryStatus(clean(memoryId, "Memory identifier", 100), status); this.emit("Memory status updated."); return this.store.snapshot(); }
  setMemoryPinned(memoryId: string, pinned: boolean): OperatingSnapshot { this.store.setMemoryPinned(clean(memoryId, "Memory identifier", 100), pinned); this.emit(pinned ? "Memory pinned." : "Memory unpinned."); return this.store.snapshot(); }
  deleteMemory(memoryId: string): OperatingSnapshot { this.store.deleteMemory(clean(memoryId, "Memory identifier", 100)); this.emit("Memory deleted from local storage."); return this.store.snapshot(); }
  reviewEvidence(evidenceId: string): OperatingSnapshot { this.store.reviewEvidence(clean(evidenceId, "Evidence identifier", 100)); this.emit("Evidence explicitly reviewed."); return this.store.snapshot(); }
  deleteMemoriesByDay(dayId: string): OperatingSnapshot { this.store.deleteMemoriesByDay(clean(dayId, "Day identifier", 100)); this.emit("Unpinned memories from the day were deleted."); return this.store.snapshot(); }
  deleteMemoriesBySession(sessionId: string): OperatingSnapshot { this.store.deleteMemoriesBySession(clean(sessionId, "Session identifier", 100)); this.emit("Unpinned memories from the session were deleted."); return this.store.snapshot(); }
  setRetentionPolicy(memoryDays: number | null, sensitiveDays: number): OperatingSnapshot { this.store.setRetentionPolicy(memoryDays, sensitiveDays); this.emit("Local retention policy updated and applied."); return this.store.snapshot(); }
  addInterventionFeedback(requestId: string, kind: InterventionFeedbackKind, note?: string): OperatingSnapshot { this.store.addInterventionFeedback(clean(requestId, "Request identifier", 100), kind, note?.trim() || null); this.emit("Intervention feedback recorded locally."); return this.store.snapshot(); }
  async createBackup(destinationDirectory: string): Promise<{ database: string; export: string }> { return this.store.createBackup(path.resolve(clean(destinationDirectory, "Backup directory", 2048))); }

  recordAmbientInvocation(telemetry: AmbientReasoningTelemetry): void {
    const triggerEvent = [...(this.ambient.getState()?.events ?? [])].reverse().find((event) => event.type === "intervention" || event.type === "day_ended" || event.type === "error");
    this.store.recordInvocation({
      day_id: this.store.getActiveDay()?.day_id ?? null, reason: telemetry.reason, urgency: telemetry.urgency,
      duration_ms: telemetry.duration_ms, prompt_characters: telemetry.prompt_characters,
      response_characters: 0, image_attached: telemetry.image_attached, cached: telemetry.cached, outcome: telemetry.outcome,
      trigger_event_id: triggerEvent?.event_id ?? null, response_used: telemetry.outcome !== "failed",
    });
  }
}
