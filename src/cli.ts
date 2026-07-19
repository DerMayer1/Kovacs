#!/usr/bin/env node

import { loadConfig } from "./config.js";
import type {
  KovacsMode,
  ObservationInput,
  ObservationKind,
  Sensitivity,
} from "./domain/types.js";
import { evaluateObservation } from "./events/policy.js";
import { KovacsAgent } from "./agent/kovacs.js";
import { KovacsDatabase } from "./memory/database.js";

const MODES = new Set<KovacsMode>([
  "training",
  "pair",
  "ship",
  "review",
  "assessment",
  "incident",
  "strategy",
]);

const OBSERVATION_KINDS = new Set<ObservationKind>([
  "manual",
  "repeated_error",
  "test_failed",
  "test_passed",
  "build_failed",
  "build_passed",
  "stuck",
  "commit",
  "meeting_question",
  "social_draft",
  "window_changed",
]);

async function main(): Promise<void> {
  const config = loadConfig();
  const database = new KovacsDatabase(config.databasePath);
  database.initialize();

  try {
    const [command = "help", ...args] = process.argv.slice(2);

    switch (command) {
      case "init":
        database.upsertMemory({
          namespace: "identity",
          key: "owner",
          content: "Lucas",
          source: "system_initialization",
          confidence: 1,
        });
        database.upsertMemory({
          namespace: "goal",
          key: "target_role",
          content: "Staff Software Engineer",
          source: "system_initialization",
          confidence: 1,
        });
        printJson({ message: "Kovacs initialized.", ...database.status() });
        break;

      case "status":
        printJson(database.status());
        break;

      case "remember":
        remember(database, args);
        break;

      case "observe":
        await observe(config, database, args);
        break;

      case "coach":
        await coach(config, database, args);
        break;

      case "reset-thread":
        database.deleteMeta("codex_thread_id");
        process.stdout.write("The next coached event will start a new Codex thread.\n");
        break;

      case "help":
      case "--help":
      case "-h":
        printHelp();
        break;

      default:
        throw new Error(`Unknown command: ${command}`);
    }
  } finally {
    database.close();
  }
}

function remember(database: KovacsDatabase, args: string[]): void {
  const namespace = args.shift();
  const key = args.shift();
  const confidence = readNumberOption(args, "--confidence") ?? 1;
  const source = readStringOption(args, "--source") ?? "lucas_cli";
  const content = args.join(" ").trim();

  if (namespace === undefined || key === undefined || content.length === 0) {
    throw new Error(
      "Usage: kovacs remember <namespace> <key> <content> [--confidence 0..1]",
    );
  }

  printJson(
    database.upsertMemory({ namespace, key, content, confidence, source }),
  );
}

async function observe(
  config: ReturnType<typeof loadConfig>,
  database: KovacsDatabase,
  args: string[],
): Promise<void> {
  const kindInput = args.shift();
  if (kindInput === undefined || !OBSERVATION_KINDS.has(kindInput as ObservationKind)) {
    throw new Error(`Observation kind must be one of: ${[...OBSERVATION_KINDS].join(", ")}`);
  }

  const kind = kindInput as ObservationKind;
  const source = readStringOption(args, "--source") ?? "manual_cli";
  const project = readStringOption(args, "--project");
  const imagePath = readStringOption(args, "--image");
  const sensitivity = (readStringOption(args, "--sensitivity") ?? "normal") as Sensitivity;
  const force = readBooleanOption(args, "--force");
  const noCoach = readBooleanOption(args, "--no-coach");
  const mode = readMode(args);
  const summary = args.join(" ").trim();

  if (summary.length === 0) {
    throw new Error("Observation summary is required.");
  }

  const input: ObservationInput = {
    kind,
    source,
    summary,
    sensitivity,
    ...(project === undefined ? {} : { project }),
    ...(imagePath === undefined ? {} : { imagePath }),
  };
  const observation = database.addObservation(input);
  const decision = evaluateObservation(observation, config.interventionThreshold);

  if (noCoach || (!force && !decision.shouldIntervene)) {
    printJson({ observation, decision, intervention: null });
    return;
  }

  const agent = new KovacsAgent(config, database);
  const result = await agent.coach({
    instruction: "Evaluate this event and give the smallest high-value intervention.",
    observation,
    mode,
    ...(imagePath === undefined ? {} : { imagePath }),
    interventionScore: decision.score,
  });
  printJson({ observation, decision, intervention: result });
}

async function coach(
  config: ReturnType<typeof loadConfig>,
  database: KovacsDatabase,
  args: string[],
): Promise<void> {
  const imagePath = readStringOption(args, "--image");
  const mode = readMode(args);
  const instruction = args.join(" ").trim();
  if (instruction.length === 0) {
    throw new Error("Usage: kovacs coach <instruction> [--mode training] [--image path]");
  }

  const agent = new KovacsAgent(config, database);
  const result = await agent.coach({
    instruction,
    mode,
    ...(imagePath === undefined ? {} : { imagePath }),
  });
  process.stdout.write(`${result.response}\n`);
}

function readMode(args: string[]): KovacsMode {
  const value = readStringOption(args, "--mode") ?? "training";
  if (!MODES.has(value as KovacsMode)) {
    throw new Error(`Mode must be one of: ${[...MODES].join(", ")}`);
  }
  return value as KovacsMode;
}

function readStringOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  const value = args[index + 1];
  if (value === undefined) {
    throw new Error(`${name} requires a value.`);
  }
  args.splice(index, 2);
  return value;
}

function readNumberOption(args: string[], name: string): number | undefined {
  const value = readStringOption(args, name);
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(`${name} must be between 0 and 1.`);
  }
  return parsed;
}

function readBooleanOption(args: string[], name: string): boolean {
  const index = args.indexOf(name);
  if (index === -1) {
    return false;
  }
  args.splice(index, 1);
  return true;
}

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function printHelp(): void {
  process.stdout.write(`Kovacs 0.1 — event-driven Staff Engineer tutor

Commands:
  kovacs init
  kovacs status
  kovacs remember <namespace> <key> <content> [--confidence 0..1]
  kovacs observe <kind> <summary> [--mode training] [--image path] [--force]
  kovacs coach <instruction> [--mode training] [--image path]
  kovacs reset-thread

Examples:
  npm run dev -- init
  npm run dev -- remember goal technical_wedge "AI systems engineering"
  npm run dev -- observe repeated_error "The same idempotency test failed three times"
  npm run dev -- coach "Start my diagnostic interview" --mode assessment
`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Kovacs error: ${message}\n`);
  process.exitCode = 1;
});
