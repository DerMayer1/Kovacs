import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { AssistanceLevel, MemoryCandidate } from "../v01/types.js";
import type { V03Contracts } from "./contracts.js";
import {
  COMPETENCIES,
  type Checkpoint,
  type CheckpointCompletionInput,
  type CheckpointStatus,
  type CheckpointTransitionInput,
  type Competency,
  type CompetencyLevel,
  type CompetencyRecord,
  type DailyPlan,
  type DayOutcome,
  type DayProposal,
  type DaySummary,
  type EndDayInput,
  type EvidenceRecord,
  type EvidenceSource,
  type InterventionFeedback,
  type InterventionFeedbackKind,
  type MemoryRecord,
  type OperatingProfile,
  type OperatingSnapshot,
  type PendingDraft,
  type RecoveryStatus,
  type RetentionPolicy,
  type SetupInput,
  type SetupProposal,
  type UsageSummary,
  type WeekInput,
  type WeekProposal,
} from "./types.js";

const identifier = (prefix: "draft" | "day" | "cp" | "ev" | "mem" | "inv" | "fb" | "audit") => `${prefix}_${randomUUID().replaceAll("-", "")}`;
const now = (): string => new Date().toISOString();
const json = <T>(value: string): T => JSON.parse(value) as T;

interface DraftRow { draft_id: string; kind: "setup" | "week" | "day"; created_at: string; project: string | null; original_objective: string | null; input_json: string | null; proposal_json: string; }
interface ProfileRow { main_goal: string; mission_title: string; mission_criteria_json: string; mission_starts_at: string; mission_target_date: string; weekly_outcome: string; weekly_criteria_json: string; weekly_competencies_json: string; week_starts_at: string; created_at: string; updated_at: string; }
interface DayRow { day_id: string; ambient_day_id: string; project: string; original_objective: string; objective: string; criteria_json: string; status: "active" | "ended"; outcome: DayOutcome | null; output_summary: string | null; validation_summary: string | null; lesson: string | null; started_at: string; ended_at: string | null; revision: number; summary_json: string | null; }
interface CheckpointRow { checkpoint_id: string; day_id: string; position: number; title: string; evidence_required: string; competency: Competency; status: "pending" | "active" | "completed" | "skipped"; lifecycle_status: CheckpointStatus | null; status_reason: string | null; completed_at: string | null; }
interface EvidenceRow { evidence_id: string; day_id: string; checkpoint_id: string | null; project: string; competency: Competency; source: EvidenceRecord["source"]; assistance_level: AssistanceLevel; outcome: DayOutcome; confidence: number; summary: string; validation: string | null; source_event_id: string | null; created_at: string; }
interface MemoryRow { memory_id: string; kind: MemoryRecord["kind"]; claim: string; source: MemoryRecord["source"]; confidence: number; sensitivity: MemoryRecord["sensitivity"]; status: MemoryRecord["status"]; pinned: number; created_at: string; updated_at: string; origin_day_id: string | null; origin_session_id: string | null; }

export interface InvocationInput {
  day_id: string | null;
  reason: string;
  urgency: "normal" | "important" | "critical";
  duration_ms: number;
  prompt_characters: number;
  response_characters?: number;
  image_attached: boolean;
  cached: boolean;
  outcome: "displayed" | "proposal" | "failed";
  model?: string | null;
  trigger_event_id?: string | null;
  response_used?: boolean;
}

export class V03Store {
  private recovery: RecoveryStatus;

  private constructor(private readonly db: DatabaseSync, private readonly contracts: V03Contracts, private readonly databasePath: string) {
    this.recovery = { schema_version: "0.3.1", database_integrity: "ok", schema_version_applied: "0.3.1", resumed_day_id: null, pending_draft_kind: null, interrupted_invocations: 0, observation_requires_manual_resume: false };
  }

  static async create(databasePath: string, contracts: V03Contracts): Promise<V03Store> {
    await mkdir(path.dirname(databasePath), { recursive: true });
    const db = new DatabaseSync(databasePath);
    db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA secure_delete=ON; PRAGMA busy_timeout=5000;");
    const store = new V03Store(db, contracts, databasePath);
    store.migrate();
    store.recover();
    store.applyRetention();
    return store;
  }

  close(): void { this.db.close(); }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS system_profile (
        singleton INTEGER PRIMARY KEY CHECK (singleton = 1), main_goal TEXT NOT NULL,
        mission_title TEXT NOT NULL, mission_criteria_json TEXT NOT NULL, mission_starts_at TEXT NOT NULL,
        mission_target_date TEXT NOT NULL, weekly_outcome TEXT NOT NULL, weekly_criteria_json TEXT NOT NULL,
        weekly_competencies_json TEXT NOT NULL, week_starts_at TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS pending_drafts (
        draft_id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('setup','week','day')), created_at TEXT NOT NULL,
        project TEXT, original_objective TEXT, input_json TEXT, proposal_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS day_plans (
        day_id TEXT PRIMARY KEY, ambient_day_id TEXT NOT NULL UNIQUE, project TEXT NOT NULL,
        original_objective TEXT NOT NULL, objective TEXT NOT NULL, criteria_json TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('active','ended')), outcome TEXT,
        output_summary TEXT, validation_summary TEXT, lesson TEXT, started_at TEXT NOT NULL, ended_at TEXT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS one_active_day ON day_plans(status) WHERE status = 'active';
      CREATE TABLE IF NOT EXISTS checkpoints (
        checkpoint_id TEXT PRIMARY KEY, day_id TEXT NOT NULL REFERENCES day_plans(day_id) ON DELETE CASCADE,
        position INTEGER NOT NULL, title TEXT NOT NULL, evidence_required TEXT NOT NULL, competency TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending','active','completed','skipped')), completed_at TEXT,
        UNIQUE(day_id, position)
      );
      CREATE TABLE IF NOT EXISTS evidence (
        evidence_id TEXT PRIMARY KEY, day_id TEXT NOT NULL REFERENCES day_plans(day_id) ON DELETE CASCADE,
        checkpoint_id TEXT REFERENCES checkpoints(checkpoint_id) ON DELETE SET NULL, project TEXT NOT NULL,
        competency TEXT NOT NULL, source TEXT NOT NULL, assistance_level TEXT NOT NULL, outcome TEXT NOT NULL,
        confidence REAL NOT NULL, summary TEXT NOT NULL, validation TEXT, source_event_id TEXT, created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS evidence_competency ON evidence(competency, created_at);
      CREATE TABLE IF NOT EXISTS competencies (
        competency TEXT PRIMARY KEY, level TEXT NOT NULL, confidence REAL NOT NULL,
        evidence_count INTEGER NOT NULL, last_evidence_at TEXT
      );
      CREATE TABLE IF NOT EXISTS memories (
        memory_id TEXT PRIMARY KEY, kind TEXT NOT NULL, claim TEXT NOT NULL, source TEXT NOT NULL,
        confidence REAL NOT NULL, sensitivity TEXT NOT NULL, status TEXT NOT NULL, pinned INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS memory_claim_unique ON memories(kind, claim);
      CREATE TABLE IF NOT EXISTS invocations (
        invocation_id TEXT PRIMARY KEY, day_id TEXT, reason TEXT NOT NULL, urgency TEXT NOT NULL,
        duration_ms INTEGER NOT NULL, prompt_characters INTEGER NOT NULL, image_attached INTEGER NOT NULL,
        cached INTEGER NOT NULL, outcome TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS v03_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS retention_policy (
        singleton INTEGER PRIMARY KEY CHECK (singleton = 1), memory_retention_days INTEGER,
        sensitive_memory_retention_days INTEGER NOT NULL, persist_window_titles INTEGER NOT NULL CHECK (persist_window_titles = 0),
        last_pruned_at TEXT
      );
      INSERT OR IGNORE INTO retention_policy VALUES (1, NULL, 30, 0, NULL);
      CREATE TABLE IF NOT EXISTS intervention_feedback (
        feedback_id TEXT PRIMARY KEY, request_id TEXT NOT NULL, day_id TEXT,
        kind TEXT NOT NULL, note TEXT, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS lifecycle_audit (
        audit_id TEXT PRIMARY KEY, entity_kind TEXT NOT NULL, entity_id TEXT NOT NULL,
        event TEXT NOT NULL, reason TEXT, metadata_json TEXT, created_at TEXT NOT NULL
      );
    `);
    this.ensureColumn("day_plans", "revision", "INTEGER NOT NULL DEFAULT 1");
    this.ensureColumn("day_plans", "summary_json", "TEXT");
    this.ensureColumn("checkpoints", "lifecycle_status", "TEXT");
    this.ensureColumn("checkpoints", "status_reason", "TEXT");
    this.ensureColumn("memories", "origin_day_id", "TEXT");
    this.ensureColumn("memories", "origin_session_id", "TEXT");
    this.ensureColumn("invocations", "response_characters", "INTEGER NOT NULL DEFAULT 0");
    this.ensureColumn("invocations", "status", "TEXT NOT NULL DEFAULT 'success'");
    this.ensureColumn("invocations", "model", "TEXT");
    this.ensureColumn("invocations", "trigger_event_id", "TEXT");
    this.ensureColumn("invocations", "response_used", "INTEGER NOT NULL DEFAULT 1");
    this.db.prepare("UPDATE checkpoints SET lifecycle_status=CASE status WHEN 'skipped' THEN 'abandoned' ELSE status END WHERE lifecycle_status IS NULL").run();
    this.db.exec("CREATE UNIQUE INDEX IF NOT EXISTS one_active_checkpoint_per_day ON checkpoints(day_id) WHERE lifecycle_status='active'");
    this.db.prepare("UPDATE evidence SET source='self_reported' WHERE source IN ('user_reported','validated')").run();
    this.db.prepare("INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES ('0.3.0', ?)").run(now());
    this.db.prepare("INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES ('0.3.1', ?)").run(now());
    this.db.prepare("INSERT OR REPLACE INTO v03_meta(key, value) VALUES ('schema_version', '0.3.1')").run();
    const insert = this.db.prepare("INSERT OR IGNORE INTO competencies(competency, level, confidence, evidence_count, last_evidence_at) VALUES (?, 'unverified', 0, 0, NULL)");
    for (const competency of COMPETENCIES) insert.run(competency);
    for (const competency of COMPETENCIES) this.recalculateCompetency(competency);
  }

  private ensureColumn(table: string, column: string, definition: string): void {
    const columns = this.db.prepare(`PRAGMA table_info(${table})`).all() as unknown as Array<{ name: string }>;
    if (!columns.some((item) => item.name === column)) this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }

  private recover(): void {
    const integrity = this.db.prepare("PRAGMA integrity_check").get() as { integrity_check: string } | undefined;
    if (integrity?.integrity_check !== "ok") throw new Error(`Kovacs database integrity check failed: ${integrity?.integrity_check ?? "unknown"}`);
    const interrupted = this.db.prepare("UPDATE invocations SET status='interrupted', outcome='failed', response_used=0 WHERE status='started'").run().changes;
    const day = this.getActiveDay();
    const pending = this.setupDraft() ?? this.weekDraft() ?? this.dayDraft();
    this.recovery = {
      schema_version: "0.3.1", database_integrity: "ok", schema_version_applied: "0.3.1",
      resumed_day_id: day?.day_id ?? null, pending_draft_kind: pending?.kind ?? null,
      interrupted_invocations: Number(interrupted), observation_requires_manual_resume: Boolean(day),
    };
  }

  saveSetupDraft(input: SetupInput, proposal: SetupProposal): PendingDraft<SetupProposal> {
    this.contracts.validateSetupProposal(proposal);
    const draft: PendingDraft<SetupProposal> = { draft_id: identifier("draft"), kind: "setup", created_at: now(), project: null, original_objective: null, input, proposal };
    this.db.prepare("DELETE FROM pending_drafts WHERE kind = 'setup'").run();
    this.db.prepare("INSERT INTO pending_drafts VALUES (?, 'setup', ?, NULL, NULL, ?, ?)").run(draft.draft_id, draft.created_at, JSON.stringify(input), JSON.stringify(proposal));
    return draft;
  }

  saveDayDraft(project: string, objective: string, proposal: DayProposal): PendingDraft<DayProposal> {
    this.contracts.validateDayProposal(proposal);
    const draft: PendingDraft<DayProposal> = { draft_id: identifier("draft"), kind: "day", created_at: now(), project, original_objective: objective, input: null, proposal };
    this.db.prepare("DELETE FROM pending_drafts WHERE kind = 'day'").run();
    this.db.prepare("INSERT INTO pending_drafts VALUES (?, 'day', ?, ?, ?, NULL, ?)").run(draft.draft_id, draft.created_at, project, objective, JSON.stringify(proposal));
    return draft;
  }

  saveWeekDraft(input: WeekInput, proposal: WeekProposal): PendingDraft<WeekProposal> {
    this.contracts.validateWeekProposal(proposal);
    const draft: PendingDraft<WeekProposal> = { draft_id: identifier("draft"), kind: "week", created_at: now(), project: null, original_objective: null, input, proposal };
    this.db.prepare("DELETE FROM pending_drafts WHERE kind = 'week'").run();
    this.db.prepare("INSERT INTO pending_drafts VALUES (?, 'week', ?, NULL, NULL, ?, ?)").run(draft.draft_id, draft.created_at, JSON.stringify(input), JSON.stringify(proposal));
    return draft;
  }

  private draftRow(kind: "setup" | "week" | "day"): DraftRow | undefined {
    return this.db.prepare("SELECT * FROM pending_drafts WHERE kind = ? ORDER BY created_at DESC LIMIT 1").get(kind) as DraftRow | undefined;
  }

  private setupDraft(row = this.draftRow("setup")): PendingDraft<SetupProposal> | null {
    if (!row) return null;
    const proposal = json<SetupProposal>(row.proposal_json); this.contracts.validateSetupProposal(proposal);
    return { draft_id: row.draft_id, kind: "setup", created_at: row.created_at, project: null, original_objective: null, input: json<SetupInput>(row.input_json ?? "null"), proposal };
  }

  private dayDraft(row = this.draftRow("day")): PendingDraft<DayProposal> | null {
    if (!row) return null;
    const proposal = json<DayProposal>(row.proposal_json); this.contracts.validateDayProposal(proposal);
    return { draft_id: row.draft_id, kind: "day", created_at: row.created_at, project: row.project, original_objective: row.original_objective, input: null, proposal };
  }

  private weekDraft(row = this.draftRow("week")): PendingDraft<WeekProposal> | null {
    if (!row) return null;
    const proposal = json<WeekProposal>(row.proposal_json); this.contracts.validateWeekProposal(proposal);
    return { draft_id: row.draft_id, kind: "week", created_at: row.created_at, project: null, original_objective: null, input: json<WeekInput>(row.input_json ?? "null"), proposal };
  }

  confirmSetup(draftId: string, mainGoal: string): OperatingProfile {
    const draft = this.setupDraft(this.db.prepare("SELECT * FROM pending_drafts WHERE draft_id = ? AND kind = 'setup'").get(draftId) as DraftRow | undefined);
    if (!draft || !draft.input) throw new Error("The setup proposal no longer exists.");
    const setupInput = draft.input as SetupInput;
    const at = now(); const target = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare(`INSERT OR REPLACE INTO system_profile VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM system_profile WHERE singleton=1), ?), ?)`)
        .run(mainGoal, draft.proposal.mission_title, JSON.stringify(draft.proposal.mission_success_criteria), at, target,
          draft.proposal.weekly_outcome, JSON.stringify(draft.proposal.weekly_success_criteria), JSON.stringify(draft.proposal.weekly_competencies), at, at, at);
      this.upsertMemory("main_goal", mainGoal, "user_stated", 1, "internal", "active", true, at);
      this.upsertMemory("routine", `Available deliberate-practice time: ${setupInput.available_hours_per_week} hours per week.`, "user_stated", 1, "internal", "active", false, at);
      this.upsertMemory("context", `Current position: ${setupInput.current_position}`, "user_stated", 1, "internal", "active", false, at);
      this.upsertMemory("context", `Active projects: ${setupInput.active_projects}`, "user_stated", 1, "internal", "active", false, at);
      this.upsertMemory("context", `Self-identified growth edges: ${setupInput.weaknesses}`, "user_stated", 1, "sensitive", "active", false, at);
      this.audit("setup", draftId, "setup_confirmed", "Explicit user confirmation", { mission: draft.proposal.mission_title, week: draft.proposal.weekly_outcome });
      this.db.prepare("DELETE FROM pending_drafts WHERE draft_id = ?").run(draftId);
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
    return this.getProfile()!;
  }

  confirmWeek(draftId: string): OperatingProfile {
    const draft = this.weekDraft(this.db.prepare("SELECT * FROM pending_drafts WHERE draft_id = ? AND kind = 'week'").get(draftId) as DraftRow | undefined);
    if (!draft) throw new Error("The weekly proposal no longer exists.");
    const at = now(), previous = this.getProfile()?.week ?? null;
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = this.db.prepare(`UPDATE system_profile SET weekly_outcome=?, weekly_criteria_json=?, weekly_competencies_json=?, week_starts_at=?, updated_at=? WHERE singleton=1`)
        .run(draft.proposal.primary_outcome, JSON.stringify(draft.proposal.success_criteria), JSON.stringify(draft.proposal.competencies), at, at);
      if (result.changes !== 1) throw new Error("Complete V0.3 setup before starting a week.");
      this.audit("week", draftId, "week_confirmed", "Explicit user confirmation", { previous, next: draft.proposal });
      this.db.prepare("DELETE FROM pending_drafts WHERE draft_id = ?").run(draftId); this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
    return this.getProfile()!;
  }

  getProfile(): OperatingProfile | null {
    const row = this.db.prepare("SELECT * FROM system_profile WHERE singleton = 1").get() as ProfileRow | undefined;
    if (!row) return null;
    return {
      schema_version: "0.3.0", main_goal: row.main_goal,
      mission: { title: row.mission_title, success_criteria: json<string[]>(row.mission_criteria_json), starts_at: row.mission_starts_at, target_date: row.mission_target_date },
      week: { primary_outcome: row.weekly_outcome, success_criteria: json<string[]>(row.weekly_criteria_json), competencies: json<Competency[]>(row.weekly_competencies_json), starts_at: row.week_starts_at },
      created_at: row.created_at, updated_at: row.updated_at,
    };
  }

  startDay(draftId: string, ambientDayId: string): DailyPlan {
    if (this.getActiveDay()) throw new Error("End the active day before starting another one.");
    const draft = this.dayDraft(this.db.prepare("SELECT * FROM pending_drafts WHERE draft_id = ? AND kind = 'day'").get(draftId) as DraftRow | undefined);
    if (!draft?.project || !draft.original_objective) throw new Error("The daily plan proposal no longer exists.");
    const dayId = identifier("day"), at = now();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare(`INSERT INTO day_plans
        (day_id, ambient_day_id, project, original_objective, objective, criteria_json, status, outcome, output_summary, validation_summary, lesson, started_at, ended_at, revision, summary_json)
        VALUES (?, ?, ?, ?, ?, ?, 'active', NULL, NULL, NULL, NULL, ?, NULL, 1, NULL)`)
        .run(dayId, ambientDayId, draft.project, draft.original_objective, draft.proposal.proposed_objective, JSON.stringify(draft.proposal.success_criteria), at);
      const insert = this.db.prepare(`INSERT INTO checkpoints
        (checkpoint_id, day_id, position, title, evidence_required, competency, status, completed_at, lifecycle_status, status_reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL)`);
      draft.proposal.checkpoints.forEach((checkpoint, index) => {
        const status = index === 0 ? "active" : "pending";
        insert.run(identifier("cp"), dayId, index, checkpoint.title, checkpoint.evidence_required, checkpoint.competency, status, status);
      });
      this.audit("day", dayId, "day_started", "Explicit daily-plan confirmation", { objective: draft.proposal.proposed_objective, project: draft.project });
      this.db.prepare("DELETE FROM pending_drafts WHERE draft_id = ?").run(draftId);
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
    return this.getActiveDay()!;
  }

  private checkpoints(dayId: string): Checkpoint[] {
    const rows = this.db.prepare("SELECT * FROM checkpoints WHERE day_id = ? ORDER BY position").all(dayId) as unknown as CheckpointRow[];
    return rows.map((row) => ({
      checkpoint_id: row.checkpoint_id, day_id: row.day_id, position: row.position, title: row.title,
      evidence_required: row.evidence_required, competency: row.competency,
      status: row.lifecycle_status ?? (row.status === "skipped" ? "abandoned" : row.status),
      status_reason: row.status_reason, completed_at: row.completed_at,
    }));
  }

  private mapDay(row: DayRow): DailyPlan {
    return {
      schema_version: "0.3.0", day_id: row.day_id, ambient_day_id: row.ambient_day_id, project: row.project,
      original_objective: row.original_objective, objective: row.objective, success_criteria: json<string[]>(row.criteria_json),
      status: row.status, outcome: row.outcome, output_summary: row.output_summary, validation_summary: row.validation_summary,
      lesson: row.lesson, started_at: row.started_at, ended_at: row.ended_at, checkpoints: this.checkpoints(row.day_id),
      revision: row.revision, deterministic_summary: row.summary_json ? json<DaySummary>(row.summary_json) : null,
    };
  }

  getActiveDay(): DailyPlan | null {
    const row = this.db.prepare("SELECT * FROM day_plans WHERE status = 'active' LIMIT 1").get() as DayRow | undefined;
    return row ? this.mapDay(row) : null;
  }

  getDay(dayId: string): DailyPlan | null {
    const row = this.db.prepare("SELECT * FROM day_plans WHERE day_id = ?").get(dayId) as DayRow | undefined;
    return row ? this.mapDay(row) : null;
  }

  listDays(): DailyPlan[] {
    const rows = this.db.prepare("SELECT * FROM day_plans ORDER BY started_at DESC").all() as unknown as DayRow[];
    return rows.map((row) => this.mapDay(row));
  }

  listEvidence(): EvidenceRecord[] {
    const rows = this.db.prepare("SELECT * FROM evidence ORDER BY created_at DESC").all() as unknown as EvidenceRow[];
    return rows.map((row) => ({ schema_version: "0.3.0", ...row }));
  }

  rejectDraft(draftId: string, reason: string): void {
    const row = this.db.prepare("SELECT kind FROM pending_drafts WHERE draft_id=?").get(draftId) as { kind: string } | undefined;
    if (!row) throw new Error("The proposal no longer exists.");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.audit(row.kind, draftId, "draft_rejected", reason);
      const invocationReason = row.kind === "setup" ? "draft_90_day_mission" : row.kind === "week" ? "draft_week" : "draft_day";
      this.db.prepare(`UPDATE invocations SET status='discarded', response_used=0
        WHERE invocation_id=(SELECT invocation_id FROM invocations WHERE reason=? AND status='success' ORDER BY created_at DESC LIMIT 1)`).run(invocationReason);
      this.db.prepare("DELETE FROM pending_drafts WHERE draft_id=?").run(draftId);
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }

  reviseDayDraft(draftId: string, proposal: DayProposal, reason: string): PendingDraft<DayProposal> {
    this.contracts.validateDayProposal(proposal);
    const row = this.db.prepare("SELECT * FROM pending_drafts WHERE draft_id=? AND kind='day'").get(draftId) as DraftRow | undefined;
    const draft = this.dayDraft(row); if (!draft) throw new Error("The daily proposal no longer exists.");
    this.db.exec("BEGIN IMMEDIATE");
    try { this.db.prepare("UPDATE pending_drafts SET proposal_json=? WHERE draft_id=?").run(JSON.stringify(proposal), draftId); this.audit("day_draft", draftId, "draft_revised", reason); this.db.exec("COMMIT"); }
    catch (error) { this.db.exec("ROLLBACK"); throw error; }
    return this.dayDraft(this.db.prepare("SELECT * FROM pending_drafts WHERE draft_id=?").get(draftId) as DraftRow | undefined)!;
  }

  reviseSetupDraft(draftId: string, proposal: SetupProposal, reason: string): PendingDraft<SetupProposal> {
    this.contracts.validateSetupProposal(proposal);
    const row = this.db.prepare("SELECT * FROM pending_drafts WHERE draft_id=? AND kind='setup'").get(draftId) as DraftRow | undefined;
    const draft = this.setupDraft(row); if (!draft) throw new Error("The setup proposal no longer exists.");
    this.db.exec("BEGIN IMMEDIATE");
    try { this.db.prepare("UPDATE pending_drafts SET proposal_json=? WHERE draft_id=?").run(JSON.stringify(proposal), draftId); this.audit("setup_draft", draftId, "draft_revised", reason); this.db.exec("COMMIT"); }
    catch (error) { this.db.exec("ROLLBACK"); throw error; }
    return this.setupDraft(this.db.prepare("SELECT * FROM pending_drafts WHERE draft_id=?").get(draftId) as DraftRow | undefined)!;
  }

  reviseWeekDraft(draftId: string, proposal: WeekProposal, reason: string): PendingDraft<WeekProposal> {
    this.contracts.validateWeekProposal(proposal);
    const row = this.db.prepare("SELECT * FROM pending_drafts WHERE draft_id=? AND kind='week'").get(draftId) as DraftRow | undefined;
    const draft = this.weekDraft(row); if (!draft) throw new Error("The weekly proposal no longer exists.");
    this.db.exec("BEGIN IMMEDIATE");
    try { this.db.prepare("UPDATE pending_drafts SET proposal_json=? WHERE draft_id=?").run(JSON.stringify(proposal), draftId); this.audit("week_draft", draftId, "draft_revised", reason); this.db.exec("COMMIT"); }
    catch (error) { this.db.exec("ROLLBACK"); throw error; }
    return this.weekDraft(this.db.prepare("SELECT * FROM pending_drafts WHERE draft_id=?").get(draftId) as DraftRow | undefined)!;
  }

  reviseActiveObjective(objective: string, reason: string): DailyPlan {
    const day = this.getActiveDay(); if (!day) throw new Error("No active V0.3 day exists.");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare("UPDATE day_plans SET objective=?, revision=revision+1 WHERE day_id=?").run(objective, day.day_id);
      this.audit("day", day.day_id, "objective_revised", reason, { previous: day.objective, next: objective });
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
    return this.getActiveDay()!;
  }

  transitionCheckpoint(input: CheckpointTransitionInput): DailyPlan {
    const row = this.db.prepare("SELECT * FROM checkpoints WHERE checkpoint_id=?").get(input.checkpoint_id) as CheckpointRow | undefined;
    if (!row) throw new Error("Checkpoint not found.");
    const day = this.getDay(row.day_id); if (!day || day.status !== "active") throw new Error("No active day owns this checkpoint.");
    if (row.lifecycle_status === "completed") throw new Error("Completed checkpoints cannot be reopened in V0.3.1.");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      if (input.status === "active") {
        this.db.prepare("UPDATE checkpoints SET status='pending', lifecycle_status='pending' WHERE day_id=? AND lifecycle_status='active'").run(day.day_id);
        this.db.prepare("UPDATE checkpoints SET status='active', lifecycle_status='active', status_reason=? WHERE checkpoint_id=?").run(input.reason, input.checkpoint_id);
      } else {
        this.db.prepare("UPDATE checkpoints SET status='skipped', lifecycle_status=?, status_reason=?, completed_at=? WHERE checkpoint_id=?")
          .run(input.status, input.reason, now(), input.checkpoint_id);
        if (row.lifecycle_status === "active" || row.status === "active") this.activateNextCheckpoint(day.day_id);
      }
      this.audit("checkpoint", input.checkpoint_id, `checkpoint_${input.status}`, input.reason);
      this.db.prepare("UPDATE day_plans SET revision=revision+1 WHERE day_id=?").run(day.day_id);
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
    return this.getActiveDay()!;
  }

  private activateNextCheckpoint(dayId: string): void {
    this.db.prepare(`UPDATE checkpoints SET status = 'active', lifecycle_status='active', status_reason=NULL
      WHERE checkpoint_id=(SELECT checkpoint_id FROM checkpoints WHERE day_id=? AND lifecycle_status='pending' ORDER BY position LIMIT 1)`).run(dayId);
  }

  private evidenceConfidence(source: EvidenceSource, outcome: DayOutcome): number {
    const sourceBase: Record<EvidenceSource, number> = { self_reported: 0.55, observed: 0.45, tool_verified: 0.95, artifact_verified: 0.95, reviewed: 0.85 };
    return Math.max(0.1, sourceBase[source] - (outcome === "achieved" ? 0 : outcome === "partially_achieved" ? 0.15 : 0.3));
  }

  private buildDaySummary(day: DailyPlan, input: EndDayInput): DaySummary {
    const count = (status: CheckpointStatus) => day.checkpoints.filter((item) => item.status === status).length;
    const carry = day.checkpoints.filter((item) => item.status !== "completed" && item.status !== "abandoned").map((item) => item.title);
    return {
      schema_version: "0.3.1", planned_objective: day.original_objective, final_objective: day.objective,
      planned_checkpoints: day.checkpoints.length, completed_checkpoints: count("completed"), blocked_checkpoints: count("blocked"),
      deferred_checkpoints: count("deferred"), abandoned_checkpoints: count("abandoned"),
      incomplete_checkpoints: day.checkpoints.length - count("completed") - count("abandoned"),
      output_summary: input.output_summary.trim(), validation_summary: input.validation_summary.trim(), lesson: input.lesson.trim(),
      outcome: input.outcome, weekly_outcome: this.getProfile()?.week.primary_outcome ?? "", carry_forward: carry,
    };
  }

  private audit(entityKind: string, entityId: string, event: string, reason: string | null, metadata?: unknown): void {
    this.db.prepare("INSERT INTO lifecycle_audit VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(identifier("audit"), entityKind, entityId, event, reason, metadata === undefined ? null : JSON.stringify(metadata), now());
  }

  completeCheckpoint(input: CheckpointCompletionInput): EvidenceRecord {
    const checkpoint = this.db.prepare("SELECT * FROM checkpoints WHERE checkpoint_id = ?").get(input.checkpoint_id) as CheckpointRow | undefined;
    if (!checkpoint || (checkpoint.lifecycle_status ?? checkpoint.status) !== "active") throw new Error("Only the active checkpoint can be completed.");
    const day = this.getDay(checkpoint.day_id); if (!day || day.status !== "active") throw new Error("No active day owns this checkpoint.");
    const at = now();
    const evidence: EvidenceRecord = {
      schema_version: "0.3.0", evidence_id: identifier("ev"), day_id: day.day_id, checkpoint_id: checkpoint.checkpoint_id,
      project: day.project, competency: checkpoint.competency,
      source: input.evidence_source ?? "self_reported",
      assistance_level: input.assistance_level, outcome: input.outcome,
      confidence: this.evidenceConfidence(input.evidence_source ?? "self_reported", input.outcome),
      summary: input.result.trim(), validation: input.validation.trim() || null, source_event_id: null, created_at: at,
    };
    this.contracts.validateEvidence(evidence);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare("UPDATE checkpoints SET status='completed', lifecycle_status='completed', status_reason=NULL, completed_at=? WHERE checkpoint_id=?").run(at, checkpoint.checkpoint_id);
      this.insertEvidence(evidence);
      this.audit("checkpoint", checkpoint.checkpoint_id, "checkpoint_completed", "Structured evidence recorded", { evidence_id: evidence.evidence_id, source: evidence.source, outcome: evidence.outcome });
      this.activateNextCheckpoint(day.day_id);
      this.recalculateCompetency(checkpoint.competency);
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
    return evidence;
  }

  endDay(input: EndDayInput): DailyPlan {
    const day = this.getActiveDay(); if (!day) throw new Error("No active V0.3 day exists.");
    const at = now();
    const evidence: EvidenceRecord = {
      schema_version: "0.3.0", evidence_id: identifier("ev"), day_id: day.day_id, checkpoint_id: null,
      project: day.project, competency: "execution_ownership", source: input.evidence_source ?? "self_reported",
      assistance_level: "A0", outcome: input.outcome, confidence: this.evidenceConfidence(input.evidence_source ?? "self_reported", input.outcome),
      summary: input.output_summary.trim(), validation: input.validation_summary.trim() || null, source_event_id: null, created_at: at,
    };
    this.contracts.validateEvidence(evidence);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare(`UPDATE checkpoints SET status='skipped', lifecycle_status='deferred',
        status_reason=COALESCE(status_reason, 'Carried forward during End Day'), completed_at=COALESCE(completed_at, ?)
        WHERE day_id=? AND lifecycle_status IN ('active','pending')`).run(at, day.day_id);
      const summary = this.buildDaySummary(this.getDay(day.day_id)!, input);
      this.db.prepare("UPDATE day_plans SET status='ended', outcome=?, output_summary=?, validation_summary=?, lesson=?, ended_at=?, summary_json=? WHERE day_id=?")
        .run(input.outcome, input.output_summary.trim(), input.validation_summary.trim(), input.lesson.trim(), at, JSON.stringify(summary), day.day_id);
      this.insertEvidence(evidence);
      this.recalculateCompetency("execution_ownership");
      this.upsertMemory("lesson", input.lesson.trim(), "user_stated", 0.9, "internal", "active", false, at);
      this.audit("day", day.day_id, "day_ended", "Explicit End Day", summary);
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
    return this.getDay(day.day_id)!;
  }

  previewDaySummary(input: EndDayInput): DaySummary {
    const day = this.getActiveDay(); if (!day) throw new Error("No active V0.3 day exists.");
    const projected: DailyPlan = { ...day, checkpoints: day.checkpoints.map((checkpoint) => checkpoint.status === "active" || checkpoint.status === "pending" ? { ...checkpoint, status: "deferred" as const } : checkpoint) };
    return this.buildDaySummary(projected, input);
  }

  private insertEvidence(evidence: EvidenceRecord): void {
    this.db.prepare("INSERT INTO evidence VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(evidence.evidence_id, evidence.day_id, evidence.checkpoint_id, evidence.project, evidence.competency, evidence.source,
        evidence.assistance_level, evidence.outcome, evidence.confidence, evidence.summary, evidence.validation, evidence.source_event_id, evidence.created_at);
  }

  private recalculateCompetency(competency: Competency): void {
    const rows = this.db.prepare("SELECT * FROM evidence WHERE competency = ? ORDER BY created_at").all(competency) as unknown as EvidenceRow[];
    const sourceWeight: Record<EvidenceSource, number> = { self_reported: 0.45, observed: 0.35, tool_verified: 1, artifact_verified: 1, reviewed: 0.85 };
    const assistanceWeight: Record<AssistanceLevel, number> = { A0: 1, A1: 0.9, A2: 0.75, A3: 0.55, A4: 0.35, A5: 0.15 };
    const outcomeWeight: Record<DayOutcome, number> = { achieved: 1, partially_achieved: 0.55, blocked: 0.2, misdirected: 0.1 };
    const score = rows.reduce((sum, row) => sum + row.confidence * sourceWeight[row.source] * assistanceWeight[row.assistance_level] * outcomeWeight[row.outcome], 0);
    const independentEvidence = rows.filter((row) => (row.source === "tool_verified" || row.source === "artifact_verified" || row.source === "reviewed") && (row.assistance_level === "A0" || row.assistance_level === "A1") && row.outcome === "achieved").length;
    let level: CompetencyLevel = "unverified";
    if (score > 0) level = "emerging";
    if (score >= 1.5 && rows.length >= 2) level = "practiced";
    if (score >= 3 && rows.length >= 4) level = "reliable";
    if (score >= 5 && independentEvidence >= 2) level = "independent";
    if (score >= 8 && rows.length >= 8 && independentEvidence >= 4) level = "leverage";
    const confidence = Math.min(1, score / 8);
    this.db.prepare("UPDATE competencies SET level=?, confidence=?, evidence_count=?, last_evidence_at=? WHERE competency=?")
      .run(level, confidence, rows.length, rows.at(-1)?.created_at ?? null, competency);
  }

  private upsertMemory(kind: MemoryRecord["kind"], claim: string, source: MemoryRecord["source"], confidence: number, sensitivity: MemoryRecord["sensitivity"], status: MemoryRecord["status"], pinned: boolean, at = now()): MemoryRecord {
    const existing = this.db.prepare("SELECT * FROM memories WHERE kind = ? AND claim = ?").get(kind, claim) as MemoryRow | undefined;
    const memory: MemoryRecord = existing ? {
      schema_version: "0.3.0", memory_id: existing.memory_id, kind, claim, source, confidence, sensitivity, status,
      pinned: pinned || Boolean(existing.pinned), created_at: existing.created_at, updated_at: at,
    } : { schema_version: "0.3.0", memory_id: identifier("mem"), kind, claim, source, confidence, sensitivity, status, pinned, created_at: at, updated_at: at };
    this.contracts.validateMemory(memory);
    this.db.prepare(`INSERT INTO memories
      (memory_id, kind, claim, source, confidence, sensitivity, status, pinned, created_at, updated_at, origin_day_id, origin_session_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)
      ON CONFLICT(kind, claim) DO UPDATE SET source=excluded.source, confidence=excluded.confidence, sensitivity=excluded.sensitivity, status=excluded.status, pinned=MAX(memories.pinned, excluded.pinned), updated_at=excluded.updated_at`)
      .run(memory.memory_id, memory.kind, memory.claim, memory.source, memory.confidence, memory.sensitivity, memory.status, memory.pinned ? 1 : 0, memory.created_at, memory.updated_at);
    return memory;
  }

  ingestMemoryCandidates(candidates: MemoryCandidate[], originDayId: string | null = null, originSessionId: string | null = null): void {
    for (const candidate of candidates) {
      if (!candidate.claim.trim()) continue;
      const kind: MemoryRecord["kind"] = candidate.memory_type === "pattern" ? "pattern" : "context";
      const source: MemoryRecord["source"] = candidate.epistemic_status === "verified" ? "verified" : candidate.epistemic_status === "observed" ? "observed" : candidate.epistemic_status === "inferred" ? "inferred" : "user_stated";
      const status: MemoryRecord["status"] = candidate.requires_confirmation || source === "inferred" ? "pending_confirmation" : "active";
      const memory = this.upsertMemory(kind, candidate.claim.trim(), source, candidate.confidence, candidate.sensitivity, status, false);
      this.db.prepare("UPDATE memories SET origin_day_id=COALESCE(origin_day_id, ?), origin_session_id=COALESCE(origin_session_id, ?) WHERE memory_id=?")
        .run(originDayId, originSessionId, memory.memory_id);
    }
  }

  listMemories(): MemoryRecord[] {
    const rows = this.db.prepare("SELECT * FROM memories ORDER BY pinned DESC, updated_at DESC").all() as unknown as MemoryRow[];
    return rows.map((row) => ({
      schema_version: "0.3.0", memory_id: row.memory_id, kind: row.kind, claim: row.claim, source: row.source,
      confidence: row.confidence, sensitivity: row.sensitivity, status: row.status, pinned: Boolean(row.pinned),
      created_at: row.created_at, updated_at: row.updated_at,
    }));
  }

  setMemoryStatus(memoryId: string, status: MemoryRecord["status"]): void {
    const result = this.db.prepare("UPDATE memories SET status=?, updated_at=? WHERE memory_id=?").run(status, now(), memoryId);
    if (result.changes !== 1) throw new Error("Memory record not found.");
  }

  setMemoryPinned(memoryId: string, pinned: boolean): void {
    const result = this.db.prepare("UPDATE memories SET pinned=?, updated_at=? WHERE memory_id=?").run(pinned ? 1 : 0, now(), memoryId);
    if (result.changes !== 1) throw new Error("Memory record not found.");
  }

  deleteMemory(memoryId: string): void {
    const result = this.db.prepare("DELETE FROM memories WHERE memory_id=?").run(memoryId);
    if (result.changes !== 1) throw new Error("Memory record not found.");
    this.db.exec("PRAGMA wal_checkpoint(PASSIVE)");
  }

  deleteMemoriesByDay(dayId: string): number {
    const removed = Number(this.db.prepare("DELETE FROM memories WHERE origin_day_id=? AND pinned=0").run(dayId).changes); this.db.exec("PRAGMA wal_checkpoint(PASSIVE)"); return removed;
  }

  deleteMemoriesBySession(sessionId: string): number {
    const removed = Number(this.db.prepare("DELETE FROM memories WHERE origin_session_id=? AND pinned=0").run(sessionId).changes); this.db.exec("PRAGMA wal_checkpoint(PASSIVE)"); return removed;
  }

  reviewEvidence(evidenceId: string): void {
    const row = this.db.prepare("SELECT competency, source FROM evidence WHERE evidence_id=?").get(evidenceId) as { competency: Competency; source: EvidenceSource } | undefined;
    if (!row) throw new Error("Evidence record not found.");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      if (row.source === "self_reported" || row.source === "observed") this.db.prepare("UPDATE evidence SET source='reviewed', confidence=MAX(confidence, 0.85) WHERE evidence_id=?").run(evidenceId);
      this.recalculateCompetency(row.competency); this.audit("evidence", evidenceId, "evidence_reviewed", "Explicit user review"); this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }

  listCompetencies(): CompetencyRecord[] {
    return this.db.prepare("SELECT * FROM competencies ORDER BY competency").all() as unknown as CompetencyRecord[];
  }

  beginInvocation(input: Pick<InvocationInput, "day_id" | "reason" | "urgency" | "image_attached"> & Partial<Pick<InvocationInput, "model" | "trigger_event_id">>): string {
    const invocationId = identifier("inv");
    this.db.prepare(`INSERT INTO invocations
      (invocation_id, day_id, reason, urgency, duration_ms, prompt_characters, image_attached, cached, outcome, created_at,
       response_characters, status, model, trigger_event_id, response_used)
      VALUES (?, ?, ?, ?, 0, 0, ?, 0, 'failed', ?, 0, 'started', ?, ?, 0)`)
      .run(invocationId, input.day_id, input.reason, input.urgency, input.image_attached ? 1 : 0, now(), input.model ?? null, input.trigger_event_id ?? null);
    return invocationId;
  }

  finishInvocation(invocationId: string, input: Omit<InvocationInput, "day_id" | "reason" | "urgency" | "image_attached">): void {
    const status = input.outcome === "failed" ? "failed" : input.response_used === false ? "discarded" : "success";
    const result = this.db.prepare(`UPDATE invocations SET duration_ms=?, prompt_characters=?, response_characters=?, cached=?,
      outcome=?, status=?, model=COALESCE(?, model), trigger_event_id=COALESCE(?, trigger_event_id), response_used=? WHERE invocation_id=?`)
      .run(Math.max(0, Math.round(input.duration_ms)), Math.max(0, Math.round(input.prompt_characters)), Math.max(0, Math.round(input.response_characters ?? 0)),
        input.cached ? 1 : 0, input.outcome, status, input.model ?? null, input.trigger_event_id ?? null, input.response_used === false ? 0 : 1, invocationId);
    if (result.changes !== 1) throw new Error("Invocation record not found.");
  }

  recordInvocation(input: InvocationInput): void {
    const invocationId = this.beginInvocation(input);
    this.finishInvocation(invocationId, input);
  }

  usageToday(): UsageSummary {
    const row = this.db.prepare(`SELECT COUNT(*) invocation_count, COALESCE(SUM(prompt_characters),0) prompt_characters,
      COALESCE(SUM(response_characters),0) response_characters, COALESCE(SUM(duration_ms),0) total_latency_ms,
      COALESCE(SUM(image_attached),0) image_invocations,
      COALESCE(SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END),0) failed_invocations,
      COALESCE(SUM(CASE WHEN status='interrupted' THEN 1 ELSE 0 END),0) interrupted_invocations,
      COALESCE(SUM(CASE WHEN status='discarded' THEN 1 ELSE 0 END),0) discarded_invocations,
      COALESCE(AVG(CASE WHEN status!='started' THEN duration_ms END),0) average_latency_ms
      FROM invocations WHERE date(created_at)=date('now')`).get() as unknown as UsageSummary;
    return row;
  }

  addInterventionFeedback(requestId: string, kind: InterventionFeedbackKind, note: string | null): InterventionFeedback {
    const feedback: InterventionFeedback = { feedback_id: identifier("fb"), request_id: requestId, day_id: this.getActiveDay()?.day_id ?? null, kind, note, created_at: now() };
    this.db.prepare("INSERT INTO intervention_feedback VALUES (?, ?, ?, ?, ?, ?)")
      .run(feedback.feedback_id, feedback.request_id, feedback.day_id, feedback.kind, feedback.note, feedback.created_at);
    return feedback;
  }

  listInterventionFeedback(limit = 20): InterventionFeedback[] {
    return this.db.prepare("SELECT * FROM intervention_feedback ORDER BY created_at DESC LIMIT ?").all(Math.max(1, Math.min(100, limit))) as unknown as InterventionFeedback[];
  }

  retentionPolicy(): RetentionPolicy {
    const row = this.db.prepare("SELECT * FROM retention_policy WHERE singleton=1").get() as { memory_retention_days: number | null; sensitive_memory_retention_days: number; last_pruned_at: string | null };
    return { schema_version: "0.3.1", memory_retention_days: row.memory_retention_days, sensitive_memory_retention_days: row.sensitive_memory_retention_days, persist_window_titles: false, last_pruned_at: row.last_pruned_at };
  }

  setRetentionPolicy(memoryRetentionDays: number | null, sensitiveRetentionDays: number): RetentionPolicy {
    if (memoryRetentionDays !== null && (!Number.isInteger(memoryRetentionDays) || memoryRetentionDays < 1 || memoryRetentionDays > 3650)) throw new Error("Memory retention must be null or between 1 and 3650 days.");
    if (!Number.isInteger(sensitiveRetentionDays) || sensitiveRetentionDays < 1 || sensitiveRetentionDays > 365) throw new Error("Sensitive retention must be between 1 and 365 days.");
    const previous = this.retentionPolicy();
    this.db.prepare("UPDATE retention_policy SET memory_retention_days=?, sensitive_memory_retention_days=? WHERE singleton=1").run(memoryRetentionDays, sensitiveRetentionDays);
    this.audit("retention", "singleton", "retention_updated", "Explicit user change", { previous, next: { memory_retention_days: memoryRetentionDays, sensitive_memory_retention_days: sensitiveRetentionDays } });
    this.applyRetention();
    return this.retentionPolicy();
  }

  applyRetention(): number {
    const policy = this.retentionPolicy();
    let removed = Number(this.db.prepare(`DELETE FROM memories WHERE pinned=0 AND sensitivity='sensitive'
      AND datetime(updated_at) < datetime('now', ?)`).run(`-${policy.sensitive_memory_retention_days} days`).changes);
    if (policy.memory_retention_days !== null) {
      removed += Number(this.db.prepare(`DELETE FROM memories WHERE pinned=0 AND sensitivity!='sensitive'
        AND datetime(updated_at) < datetime('now', ?)`).run(`-${policy.memory_retention_days} days`).changes);
    }
    this.db.prepare("UPDATE retention_policy SET last_pruned_at=? WHERE singleton=1").run(now());
    if (removed) this.db.exec("PRAGMA wal_checkpoint(PASSIVE)");
    return removed;
  }

  async createBackup(destinationDirectory: string): Promise<{ database: string; export: string }> {
    await mkdir(destinationDirectory, { recursive: true });
    const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
    const database = path.join(destinationDirectory, `kovacs-${stamp}.db`);
    const exported = path.join(destinationDirectory, `kovacs-${stamp}.json`);
    this.db.exec("PRAGMA wal_checkpoint(FULL)");
    this.db.exec(`VACUUM INTO '${database.replaceAll("'", "''")}'`);
    const payload = {
      schema_version: "0.3.1", exported_at: now(), source_database: path.basename(this.databasePath),
      profile: this.getProfile(), days: this.listDays(), evidence: this.listEvidence(), competencies: this.listCompetencies(), memories: this.listMemories(),
      usage_today: this.usageToday(), retention: this.retentionPolicy(), recent_feedback: this.listInterventionFeedback(100),
      lifecycle_audit: this.db.prepare("SELECT * FROM lifecycle_audit ORDER BY created_at DESC").all(),
      invocation_metrics: this.db.prepare(`SELECT invocation_id, day_id, reason, urgency, duration_ms, prompt_characters,
        response_characters, image_attached, cached, outcome, status, model, trigger_event_id, response_used, created_at
        FROM invocations ORDER BY created_at DESC`).all(),
    };
    await writeFile(exported, `${JSON.stringify(payload, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    return { database, export: exported };
  }

  contextSummary(): string {
    const profile = this.getProfile(), day = this.getActiveDay();
    const competence = this.listCompetencies().filter((item) => item.level !== "unverified").map((item) => `${item.competency}:${item.level} (${item.evidence_count} evidence)`).join(", ");
    return [
      profile ? `90-day mission: ${profile.mission.title}\nWeekly outcome: ${profile.week.primary_outcome}` : "No approved mission yet.",
      day ? `Daily objective: ${day.objective}\nCurrent checkpoint: ${day.checkpoints.find((item) => item.status === "active")?.title ?? "All checkpoints closed"}\nSuccess criteria: ${day.success_criteria.join(" | ")}` : "No active daily plan.",
      competence ? `Demonstrated competencies: ${competence}` : "Competencies remain unverified until evidence exists.",
    ].join("\n");
  }

  snapshot(): OperatingSnapshot {
    return {
      profile: this.getProfile(), active_day: this.getActiveDay(), pending_setup: this.setupDraft(), pending_week: this.weekDraft(), pending_day: this.dayDraft(),
      competencies: this.listCompetencies(), recent_evidence: this.listEvidence().slice(0, 50), memories: this.listMemories(), usage_today: this.usageToday(),
      recovery: this.recovery, retention: this.retentionPolicy(), recent_feedback: this.listInterventionFeedback(),
    };
  }
}
