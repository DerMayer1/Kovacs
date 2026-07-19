import { mkdir, readFile, realpath, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { ContractValidator } from "./contracts.js";
import type { Mode, SessionEvent, SessionRecord } from "./types.js";

function identifier(prefix: "ses" | "aud"): string {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

export class SessionStore {
  readonly sessionsDirectory: string;

  constructor(
    dataDirectory: string,
    private readonly contracts: ContractValidator,
  ) {
    this.sessionsDirectory = path.join(dataDirectory, "sessions");
  }

  private file(sessionId: string): string {
    if (!/^ses_[a-zA-Z0-9_-]+$/.test(sessionId)) throw new Error("Invalid session identifier.");
    return path.join(this.sessionsDirectory, `${sessionId}.json`);
  }

  private async persist(session: SessionRecord): Promise<void> {
    this.contracts.validateSession(session);
    await mkdir(this.sessionsDirectory, { recursive: true });
    const destination = this.file(session.session_id);
    const temporary = `${destination}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(session, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    await rename(temporary, destination);
  }

  async start(project: string, task: string, mode: Mode): Promise<SessionRecord> {
    const canonicalProject = await realpath(project);
    const now = new Date().toISOString();
    const session: SessionRecord = {
      schema_version: "0.1.0",
      session_id: identifier("ses"),
      project: canonicalProject,
      task,
      mode,
      status: "active",
      started_at: now,
      ended_at: null,
      events: [{
        event_id: identifier("aud"),
        occurred_at: now,
        type: "session_started",
        request_id: null,
        payload: { mode, task },
      }],
    };
    await this.persist(session);
    return session;
  }

  async load(sessionId: string): Promise<SessionRecord> {
    let raw: string;
    try {
      raw = await readFile(this.file(sessionId), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new Error(`Session not found: ${sessionId}`);
      throw error;
    }
    const session = JSON.parse(raw) as unknown;
    this.contracts.validateSession(session);
    return session;
  }

  async append(
    sessionId: string,
    event: Omit<SessionEvent, "event_id" | "occurred_at">,
  ): Promise<{ session: SessionRecord; event: SessionEvent }> {
    const session = await this.load(sessionId);
    const recorded: SessionEvent = {
      event_id: identifier("aud"),
      occurred_at: new Date().toISOString(),
      ...event,
    };
    session.events.push(recorded);
    await this.persist(session);
    return { session, event: recorded };
  }

  async complete(sessionId: string, requestId: string): Promise<SessionRecord> {
    const session = await this.load(sessionId);
    if (session.status === "completed") return session;
    const now = new Date().toISOString();
    session.status = "completed";
    session.ended_at = now;
    session.events.push({
      event_id: identifier("aud"),
      occurred_at: now,
      type: "session_completed",
      request_id: requestId,
      payload: {},
    });
    await this.persist(session);
    return session;
  }
}
