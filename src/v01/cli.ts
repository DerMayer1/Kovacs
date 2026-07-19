import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { KovacsService } from "./service.js";
import { ASSISTANCE_LEVELS, MODES, PROFILES, SENSITIVITY_LEVELS, type AssistanceLevel, type Mode, type Profile, type Sensitivity } from "./types.js";

interface ParsedArguments {
  command: string | null;
  flags: Map<string, string[]>;
  positionals: string[];
}

function parseArguments(argv: string[]): ParsedArguments {
  const [command = null, ...tokens] = argv;
  const flags = new Map<string, string[]>();
  const positionals: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === "--") continue;
    if (!token?.startsWith("--")) {
      positionals.push(token ?? "");
      continue;
    }
    const equals = token.indexOf("=");
    if (equals > 2) {
      const key = token.slice(2, equals);
      const inlineValue = token.slice(equals + 1);
      if (!inlineValue) throw new Error(`Missing value for --${key}`);
      flags.set(key, [...(flags.get(key) ?? []), inlineValue]);
      continue;
    }
    const key = token.slice(2);
    if (key === "json") {
      flags.set(key, ["true"]);
      continue;
    }
    const value = tokens[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${key}`);
    flags.set(key, [...(flags.get(key) ?? []), value]);
    index += 1;
  }
  return { command, flags, positionals };
}

function value(flags: Map<string, string[]>, key: string, required = false): string | undefined {
  const result = flags.get(key)?.at(-1);
  if (required && !result) throw new Error(`Missing required option --${key}`);
  return result;
}

function enumValue<T extends string>(candidate: string | undefined, options: readonly T[], label: string, fallback?: T): T {
  const selected = candidate ?? fallback;
  if (!selected || !options.includes(selected as T)) throw new Error(`${label} must be one of: ${options.join(", ")}`);
  return selected as T;
}

function help(): string {
  return `Kovacs V0.1 — explicit, read-only staff-engineer tutoring\n\n` +
    `  start   --project PATH --task TEXT [--mode training|pair|assessment]\n` +
    `          PATH TEXT [training|pair|assessment]  (PowerShell-safe positional form)\n` +
    `  coach   --session ID --request TEXT [context options]\n` +
    `  inspect --session ID --request TEXT [context options]\n` +
    `  assess  --session ID --request TEXT [context options]\n` +
    `  debrief --session ID --request TEXT [context options]\n` +
    `  status  --session ID [--json]\n` +
    `  Profiles also accept: SESSION_ID REQUEST [A0..A5]\n\n` +
    `Context options: --hypothesis TEXT --attempt TEXT (repeatable) --terminal-file PATH\n` +
    `                 --notes TEXT --file RELATIVE_PATH (repeatable) --assistance A0..A5\n` +
    `                 --sensitivity public|internal|sensitive|restricted --json`;
}

function renderResponse(result: Awaited<ReturnType<KovacsService["intervene"]>>): string {
  const response = result.response;
  return [
    `[${response.profile.toUpperCase()} · ${response.intervention.assistance_level}] ${response.assessment}`,
    "",
    response.intervention.message,
    "",
    `Why: ${response.reason}`,
    `Checkpoint: ${response.checkpoint}`,
    result.redaction_count > 0 ? `Privacy: ${result.redaction_count} secret value(s) redacted.` : "",
    result.context_truncated ? "Context: truncated to the configured local budget." : "",
    result.cached ? "Result: replayed from the session audit log." : "",
  ].filter((line, index, all) => line !== "" || (index > 0 && all[index - 1] !== "")).join("\n");
}

export async function runCli(argv = process.argv.slice(2)): Promise<number> {
  const parsed = parseArguments(argv);
  if (!parsed.command || parsed.command === "help" || parsed.flags.has("help")) {
    console.log(help());
    return 0;
  }

  const service = await KovacsService.create();
  const asJson = parsed.flags.has("json");
  if (parsed.command === "start") {
    const positional = [...parsed.positionals];
    const projectInput = value(parsed.flags, "project") ?? positional.shift();
    if (!projectInput) throw new Error("Missing project. Use --project PATH or the first positional argument.");
    const positionalMode = MODES.includes(positional.at(-1) as Mode) ? positional.pop() : undefined;
    const project = resolve(projectInput);
    const task = value(parsed.flags, "task") ?? positional.join(" ");
    if (!task) throw new Error("Missing task. Use --task TEXT or the second positional argument.");
    const mode = enumValue(value(parsed.flags, "mode") ?? positionalMode, MODES, "Mode", "training") as Mode;
    const session = await service.start(project, task, mode);
    console.log(asJson ? JSON.stringify(session, null, 2) : `Session ${session.session_id} started\nProject: ${session.project}\nMode: ${session.mode}\nTask: ${session.task}`);
    return 0;
  }

  if (parsed.command === "status") {
    const sessionId = value(parsed.flags, "session") ?? parsed.positionals[0];
    if (!sessionId) throw new Error("Missing session. Use --session ID or the first positional argument.");
    const session = await service.status(sessionId);
    console.log(asJson ? JSON.stringify(session, null, 2) : `Session ${session.session_id}: ${session.status}\nMode: ${session.mode}\nEvents: ${session.events.length}\nTask: ${session.task}`);
    return 0;
  }

  const profile = enumValue(parsed.command, PROFILES, "Command") as Profile;
  const positional = [...parsed.positionals];
  const sessionId = value(parsed.flags, "session") ?? positional.shift();
  if (!sessionId) throw new Error("Missing session. Use --session ID or the first positional argument.");
  const positionalAssistance = ASSISTANCE_LEVELS.includes(positional.at(-1) as AssistanceLevel) ? positional.pop() : undefined;
  const requestedHelp = value(parsed.flags, "request") ?? positional.join(" ");
  if (!requestedHelp) throw new Error("Missing request. Use --request TEXT or the second positional argument.");
  const terminalFile = value(parsed.flags, "terminal-file");
  const terminal = terminalFile ? await readFile(resolve(terminalFile), "utf8") : "";
  const defaultAssistance: Record<Profile, AssistanceLevel> = { coach: "A3", inspect: "A3", assess: "A1", debrief: "A2" };
  const explicitRequestId = value(parsed.flags, "request-id");
  const result = await service.intervene(sessionId, profile, {
    ...(explicitRequestId ? { requestId: explicitRequestId } : {}),
    requestedHelp,
    currentHypothesis: value(parsed.flags, "hypothesis") ?? null,
    attempts: parsed.flags.get("attempt") ?? [],
    allowedAssistance: enumValue(value(parsed.flags, "assistance") ?? positionalAssistance, ASSISTANCE_LEVELS, "Assistance", defaultAssistance[profile]),
    sensitivity: enumValue(value(parsed.flags, "sensitivity"), SENSITIVITY_LEVELS, "Sensitivity", "internal") as Sensitivity,
    terminal,
    notes: value(parsed.flags, "notes") ?? "",
    selectedFiles: parsed.flags.get("file") ?? [],
  });
  console.log(asJson ? JSON.stringify(result, null, 2) : renderResponse(result));
  return 0;
}
