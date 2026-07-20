import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { AssistanceLevel, MemoryCandidate } from "../v01/types.js";
import type { V03Contracts } from "./contracts.js";
import {
  COMPETENCIES,
  type Checkpoint,
  type CheckpointCompletionInput,
  type Competency,
  type CompetencyLevel,
  type CompetencyRecord,
  type DailyPlan,
  type DayOutcome,
  type DayProposal,
  type EndDayInput,
  type EvidenceRecord,
  type MemoryRecord,
  type OperatingProfile,
  type OperatingSnapshot,
  type PendingDraft,
  type SetupInput,
  type SetupProposal,
  type UsageSummary,
  type WeekInput,
  type WeekProposal,
} from "./types.js";

const identifier = (prefix: "draft" | "day" | "cp" | "ev" | "mem" | "inv") => `${prefix}_${randomUUID().replaceAll("-", "")}`;
const now = (): string => new Date().toISOString();
const json = <T>(value: string): T => JSON.parse(value) as T;

interface DraftRow { draft_id: string; kind: "setup" | "week" | "day"; created_at: string; project: string | null; original_objective: string | null; input_json: string | null; proposal_json: string; }
interface ProfileRow { main_goal: string; mission_title: string; mission_criteria_json: string; mission_starts_at: string; mission_target_date: string; weekly_outcome: string; weekly_criteria_json: string; weekly_competencies_json: string; week_starts_at: string; created_at: string; updated_at: string; }
interface DayRow { day_id: string; ambient_day_id: string; project: string; original_objective: string; objective: string; criteria_json: string; status: "active" | "ended"; outcome: DayOutcome | null; output_summary: string | null; validation_summary: string | null; lesson: string | null; started_at: string; ended_at: string | null; }
interface CheckpointRow { checkpoint_id: string; day_id: string; position: number; title: string; evidence_required: string; competency: Competency; status: Checkpoint["status"]; completed_at: string | null; }
interface EvidenceRow { evidence_id: string; day_id: string; checkpoint_id: string | null; project: string; competency: Competency; source: EvidenceRecord["source"]; assistance_level: AssistanceLevel; outcome: DayOutcome; confidence: number; summary: string; validation: string | null; source_event_id: string | null; created_at: string; }
interface MemoryRow { memory_id: string; kind: MemoryRecord["kind"]; claim: string; source: MemoryRecord["source"]; confidence: number; sensitivity: MemoryRecord["sensitivity"]; status: MemoryRecord["status"]; pinned: number; created_at: string; updated_at: string; }

export interface InvocationInput {
  day_id: string | null;
  reason: string;
  urgency: "normal" | "important" | "critical";
  duration_ms: number;
  prompt_characters: number;
  image_attached: boolean;
  cached: boolean;
  outcome: "displayed" | "proposal" | "failed";
}

export class V03Store {
  private constructor(private readonly db: DatabaseSync, private readonly contracts: V03Contracts) {}

  static async create(databasePath: string, contracts: V03Contracts): Promise<V03Store> {
    await mkdir(path.dirname(databasePath), { recursive: true });
    const db = new DatabaseSync(databasePath);
    db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
    const store = new V03Store(db, contracts);
    store.migrate();
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
      INSERT OR REPLACE INTO v03_meta(key, value) VALUES ('schema_version', '0.3.0');
    `);
    const insert = this.db.prepare("INSERT OR IGNORE INTO competencies(competency, level, confidence, evidence_count, last_evidence_at) VALUES (?, 'unverified', 0, 0, NULL)");
    for (const competency of COMPETENCIES) insert.run(competency);
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
      this.db.prepare("DELETE FROM pending_drafts WHERE draft_id = ?").run(draftId);
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
    return this.getProfile()!;
  }

  confirmWeek(draftId: string): OperatingProfile {
    const draft = this.weekDraft(this.db.prepare("SELECT * FROM pending_drafts WHERE draft_id = ? AND kind = 'week'").get(draftId) as DraftRow | undefined);
    if (!draft) throw new Error("The weekly proposal no longer exists.");
    const at = now();
    const result = this.db.prepare(`UPDATE system_profile SET weekly_outcome=?, weekly_criteria_json=?, weekly_competencies_json=?, week_starts_at=?, updated_at=? WHERE singleton=1`)
      .run(draft.proposal.primary_outcome, JSON.stringify(draft.proposal.success_criteria), JSON.stringify(draft.proposal.competencies), at, at);
    if (result.changes !== 1) throw new Error("Complete V0.3 setup before starting a week.");
    this.db.prepare("DELETE FROM pending_drafts WHERE draft_id = ?").run(draftId);
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
      this.db.prepare("INSERT INTO day_plans VALUES (?, ?, ?, ?, ?, ?, 'active', NULL, NULL, NULL, NULL, ?, NULL)")
        .run(dayId, ambientDayId, draft.project, draft.original_objective, draft.proposal.proposed_objective, JSON.stringify(draft.proposal.success_criteria), at);
      const insert = this.db.prepare("INSERT INTO checkpoints VALUES (?, ?, ?, ?, ?, ?, ?, NULL)");
      draft.proposal.checkpoints.forEach((checkpoint, index) => insert.run(identifier("cp"), dayId, index, checkpoint.title, checkpoint.evidence_required, checkpoint.competency, index === 0 ? "active" : "pending"));
      this.db.prepare("DELETE FROM pending_drafts WHERE draft_id = ?").run(draftId);
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
    return this.getActiveDay()!;
  }

  private checkpoints(dayId: string): Checkpoint[] {
    const rows = this.db.prepare("SELECT * FROM checkpoints WHERE day_id = ? ORDER BY position").all(dayId) as unknown as CheckpointRow[];
    return rows.map((row) => ({ ...row }));
  }

  private mapDay(row: DayRow): DailyPlan {
    return { schema_version: "0.3.0", ...row, success_criteria: json<string[]>(row.criteria_json), checkpoints: this.checkpoints(row.day_id) };
  }

  getActiveDay(): DailyPlan | null {
    const row = this.db.prepare("SELECT * FROM day_plans WHERE status = 'active' LIMIT 1").get() as DayRow | undefined;
    return row ? this.mapDay(row) : null;
  }

  getDay(dayId: string): DailyPlan | null {
    const row = this.db.prepare("SELECT * FROM day_plans WHERE day_id = ?").get(dayId) as DayRow | undefined;
    return row ? this.mapDay(row) : null;
  }

  completeCheckpoint(input: CheckpointCompletionInput): EvidenceRecord {
    const checkpoint = this.db.prepare("SELECT * FROM checkpoints WHERE checkpoint_id = ?").get(input.checkpoint_id) as CheckpointRow | undefined;
    if (!checkpoint || checkpoint.status === "completed" || checkpoint.status === "skipped") throw new Error("Checkpoint is unavailable or already closed.");
    const day = this.getDay(checkpoint.day_id); if (!day || day.status !== "active") throw new Error("No active day owns this checkpoint.");
    const at = now();
    const evidence: EvidenceRecord = {
      schema_version: "0.3.0", evidence_id: identifier("ev"), day_id: day.day_id, checkpoint_id: checkpoint.checkpoint_id,
      project: day.project, competency: checkpoint.competency,
      source: input.outcome === "achieved" && input.validation.trim() ? "validated" : "user_reported",
      assistance_level: input.assistance_level, outcome: input.outcome,
      confidence: input.outcome === "achieved" && input.validation.trim() ? 0.9 : 0.65,
      summary: input.result.trim(), validation: input.validation.trim() || null, source_event_id: null, created_at: at,
    };
    this.contracts.validateEvidence(evidence);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare("UPDATE checkpoints SET status = 'completed', completed_at = ? WHERE checkpoint_id = ?").run(at, checkpoint.checkpoint_id);
      this.insertEvidence(evidence);
      this.db.prepare("UPDATE checkpoints SET status = 'active' WHERE checkpoint_id = (SELECT checkpoint_id FROM checkpoints WHERE day_id = ? AND status = 'pending' ORDER BY position LIMIT 1)").run(day.day_id);
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
      project: day.project, competency: "execution_ownership", source: input.validation_summary.trim() ? "validated" : "user_reported",
      assistance_level: "A0", outcome: input.outcome, confidence: input.outcome === "achieved" ? 0.9 : 0.65,
      summary: input.output_summary.trim(), validation: input.validation_summary.trim() || null, source_event_id: null, created_at: at,
    };
    this.contracts.validateEvidence(evidence);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare("UPDATE day_plans SET status='ended', outcome=?, output_summary=?, validation_summary=?, lesson=?, ended_at=? WHERE day_id=?")
        .run(input.outcome, input.output_summary.trim(), input.validation_summary.trim(), input.lesson.trim(), at, day.day_id);
      this.insertEvidence(evidence);
      this.recalculateCompetency("execution_ownership");
      this.upsertMemory("lesson", input.lesson.trim(), "user_stated", 0.9, "internal", "active", false, at);
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
    return this.getDay(day.day_id)!;
  }

  private insertEvidence(evidence: EvidenceRecord): void {
    this.db.prepare("INSERT INTO evidence VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(evidence.evidence_id, evidence.day_id, evidence.checkpoint_id, evidence.project, evidence.competency, evidence.source,
        evidence.assistance_level, evidence.outcome, evidence.confidence, evidence.summary, evidence.validation, evidence.source_event_id, evidence.created_at);
  }

  private recalculateCompetency(competency: Competency): void {
    const rows = this.db.prepare("SELECT * FROM evidence WHERE competency = ? ORDER BY created_at").all(competency) as unknown as EvidenceRow[];
    const sourceWeight = { observed: 0.35, user_reported: 0.55, validated: 1 } as const;
    const assistanceWeight: Record<AssistanceLevel, number> = { A0: 1, A1: 0.9, A2: 0.75, A3: 0.55, A4: 0.35, A5: 0.15 };
    const outcomeWeight: Record<DayOutcome, number> = { achieved: 1, partially_achieved: 0.55, blocked: 0.2, misdirected: 0.1 };
    const score = rows.reduce((sum, row) => sum + row.confidence * sourceWeight[row.source] * assistanceWeight[row.assistance_level] * outcomeWeight[row.outcome], 0);
    const independentEvidence = rows.filter((row) => row.source === "validated" && (row.assistance_level === "A0" || row.assistance_level === "A1") && row.outcome === "achieved").length;
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
    this.db.prepare(`INSERT INTO memories VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(kind, claim) DO UPDATE SET source=excluded.source, confidence=excluded.confidence, sensitivity=excluded.sensitivity, status=excluded.status, pinned=MAX(memories.pinned, excluded.pinned), updated_at=excluded.updated_at`)
      .run(memory.memory_id, memory.kind, memory.claim, memory.source, memory.confidence, memory.sensitivity, memory.status, memory.pinned ? 1 : 0, memory.created_at, memory.updated_at);
    return memory;
  }

  ingestMemoryCandidates(candidates: MemoryCandidate[]): void {
    for (const candidate of candidates) {
      if (!candidate.claim.trim()) continue;
      const kind: MemoryRecord["kind"] = candidate.memory_type === "pattern" ? "pattern" : "context";
      const source: MemoryRecord["source"] = candidate.epistemic_status === "verified" ? "verified" : candidate.epistemic_status === "observed" ? "observed" : candidate.epistemic_status === "inferred" ? "inferred" : "user_stated";
      const status: MemoryRecord["status"] = candidate.requires_confirmation || source === "inferred" ? "pending_confirmation" : "active";
      this.upsertMemory(kind, candidate.claim.trim(), source, candidate.confidence, candidate.sensitivity, status, false);
    }
  }

  listMemories(): MemoryRecord[] {
    const rows = this.db.prepare("SELECT * FROM memories ORDER BY pinned DESC, updated_at DESC").all() as unknown as MemoryRow[];
    return rows.map((row) => ({ schema_version: "0.3.0", ...row, pinned: Boolean(row.pinned) }));
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
  }

  listCompetencies(): CompetencyRecord[] {
    return this.db.prepare("SELECT * FROM competencies ORDER BY competency").all() as unknown as CompetencyRecord[];
  }

  recordInvocation(input: InvocationInput): void {
    this.db.prepare("INSERT INTO invocations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(identifier("inv"), input.day_id, input.reason, input.urgency, Math.max(0, Math.round(input.duration_ms)), Math.max(0, Math.round(input.prompt_characters)), input.image_attached ? 1 : 0, input.cached ? 1 : 0, input.outcome, now());
  }

  usageToday(): UsageSummary {
    const row = this.db.prepare(`SELECT COUNT(*) invocation_count, COALESCE(SUM(prompt_characters),0) prompt_characters,
      COALESCE(SUM(duration_ms),0) total_latency_ms, COALESCE(SUM(image_attached),0) image_invocations
      FROM invocations WHERE date(created_at)=date('now')`).get() as unknown as UsageSummary;
    return row;
  }

  contextSummary(): string {
    const profile = this.getProfile(), day = this.getActiveDay();
    const competence = this.listCompetencies().filter((item) => item.level !== "unverified").map((item) => `${item.competency}:${item.level} (${item.evidence_count} evidence)`).join(", ");
    return [
      profile ? `90-day mission: ${profile.mission.title}\nWeekly outcome: ${profile.week.primary_outcome}` : "No approved mission yet.",
      day ? `Current checkpoint: ${day.checkpoints.find((item) => item.status === "active")?.title ?? "All checkpoints closed"}\nSuccess criteria: ${day.success_criteria.join(" | ")}` : "No active daily plan.",
      competence ? `Demonstrated competencies: ${competence}` : "Competencies remain unverified until evidence exists.",
    ].join("\n");
  }

  snapshot(): OperatingSnapshot {
    return {
      profile: this.getProfile(), active_day: this.getActiveDay(), pending_setup: this.setupDraft(), pending_week: this.weekDraft(), pending_day: this.dayDraft(),
      competencies: this.listCompetencies(), memories: this.listMemories(), usage_today: this.usageToday(),
    };
  }
}
