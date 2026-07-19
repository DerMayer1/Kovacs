import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import type {
  MemoryRecord,
  MemoryRecordInput,
  Observation,
  ObservationInput,
  RuntimeStatus,
} from "../domain/types.js";

interface CountRow {
  count: number;
}

interface MetaRow {
  value: string;
}

interface ObservationRow {
  id: number;
  occurred_at: string;
  kind: ObservationInput["kind"];
  source: string;
  summary: string;
  payload_json: string;
  sensitivity: ObservationInput["sensitivity"];
  image_path: string | null;
  project: string | null;
  processed_at: string | null;
}

interface MemoryRow {
  id: number;
  namespace: string;
  key: string;
  content: string;
  source: string;
  confidence: number;
  sensitivity: MemoryRecordInput["sensitivity"];
  expires_at: string | null;
  evidence_reference: string | null;
  created_at: string;
  updated_at: string;
}

export class KovacsDatabase {
  readonly databasePath: string;
  private readonly db: DatabaseSync;

  constructor(databasePath: string) {
    this.databasePath = path.resolve(databasePath);
    fs.mkdirSync(path.dirname(this.databasePath), { recursive: true });
    this.db = new DatabaseSync(this.databasePath);
    this.db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  }

  initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS observations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        occurred_at TEXT NOT NULL,
        kind TEXT NOT NULL,
        source TEXT NOT NULL,
        summary TEXT NOT NULL,
        payload_json TEXT NOT NULL DEFAULT '{}',
        sensitivity TEXT NOT NULL DEFAULT 'normal',
        image_path TEXT,
        project TEXT,
        processed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS interventions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        observation_id INTEGER,
        created_at TEXT NOT NULL,
        mode TEXT NOT NULL,
        response TEXT NOT NULL,
        score REAL NOT NULL,
        outcome TEXT,
        FOREIGN KEY (observation_id) REFERENCES observations(id)
      );

      CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        namespace TEXT NOT NULL,
        key TEXT NOT NULL,
        content TEXT NOT NULL,
        source TEXT NOT NULL,
        confidence REAL NOT NULL CHECK(confidence >= 0 AND confidence <= 1),
        sensitivity TEXT NOT NULL DEFAULT 'normal',
        expires_at TEXT,
        evidence_reference TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(namespace, key)
      );

      CREATE INDEX IF NOT EXISTS observations_recent_idx
      ON observations(occurred_at DESC);

      CREATE INDEX IF NOT EXISTS memories_namespace_idx
      ON memories(namespace, updated_at DESC);
    `);

    if (this.getMeta("initialized_at") === null) {
      this.setMeta("initialized_at", new Date().toISOString());
    }
  }

  close(): void {
    this.db.close();
  }

  getMeta(key: string): string | null {
    const row = this.db
      .prepare("SELECT value FROM meta WHERE key = ?")
      .get(key) as MetaRow | undefined;
    return row?.value ?? null;
  }

  setMeta(key: string, value: string): void {
    this.db
      .prepare(`
        INSERT INTO meta(key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `)
      .run(key, value);
  }

  deleteMeta(key: string): void {
    this.db.prepare("DELETE FROM meta WHERE key = ?").run(key);
  }

  addObservation(input: ObservationInput): Observation {
    const occurredAt = new Date().toISOString();
    const result = this.db
      .prepare(`
        INSERT INTO observations(
          occurred_at, kind, source, summary, payload_json,
          sensitivity, image_path, project
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        occurredAt,
        input.kind,
        input.source,
        input.summary,
        JSON.stringify(input.payload ?? {}),
        input.sensitivity ?? "normal",
        input.imagePath ?? null,
        input.project ?? null,
      );

    const observation = this.getObservation(Number(result.lastInsertRowid));
    if (observation === null) {
      throw new Error("Observation was inserted but could not be reloaded.");
    }
    return observation;
  }

  getObservation(id: number): Observation | null {
    const row = this.db
      .prepare("SELECT * FROM observations WHERE id = ?")
      .get(id) as ObservationRow | undefined;
    return row === undefined ? null : mapObservation(row);
  }

  recentObservations(limit = 12): Observation[] {
    const rows = this.db
      .prepare("SELECT * FROM observations ORDER BY occurred_at DESC LIMIT ?")
      .all(limit) as unknown as ObservationRow[];
    return rows.map(mapObservation);
  }

  markObservationProcessed(id: number): void {
    this.db
      .prepare("UPDATE observations SET processed_at = ? WHERE id = ?")
      .run(new Date().toISOString(), id);
  }

  recordIntervention(input: {
    observationId?: number;
    mode: string;
    response: string;
    score: number;
  }): number {
    const result = this.db
      .prepare(`
        INSERT INTO interventions(
          observation_id, created_at, mode, response, score
        ) VALUES (?, ?, ?, ?, ?)
      `)
      .run(
        input.observationId ?? null,
        new Date().toISOString(),
        input.mode,
        input.response,
        input.score,
      );
    return Number(result.lastInsertRowid);
  }

  upsertMemory(input: MemoryRecordInput): MemoryRecord {
    const now = new Date().toISOString();
    this.db
      .prepare(`
        INSERT INTO memories(
          namespace, key, content, source, confidence, sensitivity,
          expires_at, evidence_reference, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(namespace, key) DO UPDATE SET
          content = excluded.content,
          source = excluded.source,
          confidence = excluded.confidence,
          sensitivity = excluded.sensitivity,
          expires_at = excluded.expires_at,
          evidence_reference = excluded.evidence_reference,
          updated_at = excluded.updated_at
      `)
      .run(
        input.namespace,
        input.key,
        input.content,
        input.source,
        input.confidence,
        input.sensitivity ?? "normal",
        input.expiresAt ?? null,
        input.evidenceReference ?? null,
        now,
        now,
      );

    const row = this.db
      .prepare("SELECT * FROM memories WHERE namespace = ? AND key = ?")
      .get(input.namespace, input.key) as unknown as MemoryRow | undefined;
    if (row === undefined) {
      throw new Error("Memory was upserted but could not be reloaded.");
    }
    return mapMemory(row);
  }

  activeMemories(limit = 30): MemoryRecord[] {
    const now = new Date().toISOString();
    const rows = this.db
      .prepare(`
        SELECT * FROM memories
        WHERE expires_at IS NULL OR expires_at > ?
        ORDER BY confidence DESC, updated_at DESC
        LIMIT ?
      `)
      .all(now, limit) as unknown as MemoryRow[];
    return rows.map(mapMemory);
  }

  status(): RuntimeStatus {
    return {
      databasePath: this.databasePath,
      initializedAt: this.getMeta("initialized_at"),
      codexThreadId: this.getMeta("codex_thread_id"),
      observations: this.count("observations"),
      interventions: this.count("interventions"),
      memories: this.count("memories"),
    };
  }

  private count(table: "observations" | "interventions" | "memories"): number {
    const row = this.db
      .prepare(`SELECT COUNT(*) AS count FROM ${table}`)
      .get() as unknown as CountRow | undefined;
    if (row === undefined) {
      throw new Error(`Could not count ${table}.`);
    }
    return row.count;
  }
}

function mapObservation(row: ObservationRow): Observation {
  return {
    id: row.id,
    occurredAt: row.occurred_at,
    kind: row.kind,
    source: row.source,
    summary: row.summary,
    payload: JSON.parse(row.payload_json) as Record<string, unknown>,
    sensitivity: row.sensitivity ?? "normal",
    ...(row.image_path === null ? {} : { imagePath: row.image_path }),
    ...(row.project === null ? {} : { project: row.project }),
    processedAt: row.processed_at,
  };
}

function mapMemory(row: MemoryRow): MemoryRecord {
  return {
    id: row.id,
    namespace: row.namespace,
    key: row.key,
    content: row.content,
    source: row.source,
    confidence: row.confidence,
    sensitivity: row.sensitivity ?? "normal",
    ...(row.expires_at === null ? {} : { expiresAt: row.expires_at }),
    ...(row.evidence_reference === null
      ? {}
      : { evidenceReference: row.evidence_reference }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
