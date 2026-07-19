import path from "node:path";

import { Codex, type Input, type Thread } from "@openai/codex-sdk";

import type { KovacsConfig } from "../config.js";
import type { KovacsMode, Observation } from "../domain/types.js";
import { formatKovacsContext, loadKovacsContext } from "../memory/context.js";
import type { KovacsDatabase } from "../memory/database.js";
import { KOVACS_CONSTITUTION } from "./constitution.js";

export interface CoachRequest {
  instruction: string;
  mode?: KovacsMode;
  observation?: Observation;
  imagePath?: string;
  interventionScore?: number;
}

export interface CoachResult {
  response: string;
  threadId: string;
}

export class KovacsAgent {
  private readonly codex: Codex;

  constructor(
    private readonly config: KovacsConfig,
    private readonly database: KovacsDatabase,
  ) {
    this.codex = new Codex();
  }

  async coach(request: CoachRequest): Promise<CoachResult> {
    const thread = this.getThread();
    const input = this.buildInput(request);
    const result = await thread.run(input);
    const threadId = thread.id;

    if (threadId === null) {
      throw new Error("Codex completed the turn without returning a thread ID.");
    }

    this.database.setMeta("codex_thread_id", threadId);
    this.database.recordIntervention({
      ...(request.observation === undefined
        ? {}
        : { observationId: request.observation.id }),
      mode: request.mode ?? "training",
      response: result.finalResponse,
      score: request.interventionScore ?? 1,
    });

    if (request.observation !== undefined) {
      this.database.markObservationProcessed(request.observation.id);
    }

    return { response: result.finalResponse, threadId };
  }

  private getThread(): Thread {
    const options = {
      workingDirectory: this.config.codexWorkingDirectory,
      sandboxMode: "read-only" as const,
      approvalPolicy: "never" as const,
      modelReasoningEffort: "high" as const,
      webSearchMode: "cached" as const,
    };
    const existingThreadId = this.database.getMeta("codex_thread_id");
    return existingThreadId === null
      ? this.codex.startThread(options)
      : this.codex.resumeThread(existingThreadId, options);
  }

  private buildInput(request: CoachRequest): Input {
    const context = formatKovacsContext(loadKovacsContext(this.database));
    const observation = request.observation === undefined
      ? "No structured observation was attached."
      : JSON.stringify(request.observation, null, 2);

    const prompt = `${KOVACS_CONSTITUTION}

## Active mode
${request.mode ?? "training"}

## Current observation
${observation}

${context}

## Lucas's request
${request.instruction}`;

    if (request.imagePath === undefined) {
      return prompt;
    }

    return [
      { type: "text", text: prompt },
      { type: "local_image", path: path.resolve(request.imagePath) },
    ];
  }
}
