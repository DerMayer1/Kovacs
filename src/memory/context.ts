import type { MemoryRecord, Observation } from "../domain/types.js";
import type { KovacsDatabase } from "./database.js";

export interface KovacsContext {
  memories: MemoryRecord[];
  recentObservations: Observation[];
}

export function loadKovacsContext(database: KovacsDatabase): KovacsContext {
  return {
    memories: database.activeMemories(24),
    recentObservations: database.recentObservations(10),
  };
}

export function formatKovacsContext(context: KovacsContext): string {
  const memories = context.memories.length === 0
    ? "- No durable learner memories yet."
    : context.memories
        .map(
          (memory) =>
            `- [${memory.namespace}/${memory.key}] ${memory.content} ` +
            `(source=${memory.source}, confidence=${memory.confidence.toFixed(2)})`,
        )
        .join("\n");

  const observations = context.recentObservations.length === 0
    ? "- No prior observations yet."
    : context.recentObservations
        .map(
          (observation) =>
            `- ${observation.occurredAt} [${observation.kind}] ` +
            `${observation.summary} (source=${observation.source})`,
        )
        .join("\n");

  return `## Durable learner memory\n${memories}\n\n## Recent observations\n${observations}`;
}
