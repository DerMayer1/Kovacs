import { access, copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import type { V01Config } from "./config.js";
import type { GatewayExecution, GatewayInvocation, ReasoningGateway } from "./types.js";

async function discoverCodex(configured: string | null): Promise<string> {
  if (configured) {
    await access(configured);
    return configured;
  }
  if (process.platform === "win32") {
    const commandResult = spawnSync("where.exe", ["codex.cmd"], { encoding: "utf8", windowsHide: true });
    const commandPath = commandResult.stdout?.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
    if (commandPath) {
      const installationRoot = path.dirname(commandPath);
      const npmBinary = path.join(
        installationRoot,
        "node_modules", "@openai", "codex", "node_modules", "@openai", "codex-win32-x64",
        "vendor", "x86_64-pc-windows-msvc", "bin", "codex.exe",
      );
      if (existsSync(npmBinary)) return npmBinary;
    }
    const result = spawnSync("where.exe", ["codex.exe"], { encoding: "utf8", windowsHide: true });
    const candidate = result.stdout?.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
    if (candidate) return candidate;
    return "codex.exe";
  }
  return "codex";
}

function terminateTree(child: ReturnType<typeof spawn>): void {
  if (!child.pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true });
  } else {
    child.kill("SIGKILL");
  }
}

export class CodexExecGateway implements ReasoningGateway {
  constructor(private readonly config: V01Config) {}

  async execute(invocation: GatewayInvocation): Promise<GatewayExecution> {
    const executable = await discoverCodex(this.config.codexBinary);
    const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "kovacs-v01-"));
    const outputPath = path.join(temporaryDirectory, "response.json");
    const isolatedCodexHome = path.join(temporaryDirectory, "codex-home");
    await mkdir(isolatedCodexHome);
    const sourceCodexHome = process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex");
    const sourceAuth = path.join(sourceCodexHome, "auth.json");
    if (existsSync(sourceAuth)) await copyFile(sourceAuth, path.join(isolatedCodexHome, "auth.json"));
    const args = [
      "exec",
      "--ephemeral",
      "--ignore-user-config",
      "--json",
      "--sandbox", "read-only",
      "--cd", invocation.project,
      "--output-schema", invocation.outputSchemaPath ?? this.config.responseSchemaPath,
      "--output-last-message", outputPath,
      "--color", "never",
      "-c", 'approval_policy="never"',
      "-c", 'web_search="disabled"',
      ...((invocation.imagePaths ?? []).flatMap((imagePath) => ["--image", imagePath])),
      "-",
    ];
    const started = performance.now();

    try {
      const execution = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
        const childEnvironment: NodeJS.ProcessEnv = { ...process.env, CODEX_HOME: isolatedCodexHome, NO_COLOR: "1" };
        delete childEnvironment.CODEX_CLI_PATH;
        delete childEnvironment.BROWSER_USE_CODEX_APP_BUILD_FLAVOR;
        delete childEnvironment.BROWSER_USE_CODEX_APP_VERSION;
        const child = spawn(executable, args, {
          cwd: invocation.project,
          stdio: ["pipe", "pipe", "pipe"],
          windowsHide: true,
          env: childEnvironment,
        });
        let stdout = "";
        let stderr = "";
        const maxCapture = 4_000_000;
        child.stdout.on("data", (chunk: Buffer) => { if (stdout.length < maxCapture) stdout += chunk.toString("utf8"); });
        child.stderr.on("data", (chunk: Buffer) => { if (stderr.length < maxCapture) stderr += chunk.toString("utf8"); });
        child.on("error", reject);
        const timeout = setTimeout(() => {
          terminateTree(child);
          reject(new Error(`Codex execution timed out after ${this.config.codexTimeoutMs}ms.`));
        }, this.config.codexTimeoutMs);
        child.on("close", (code) => {
          clearTimeout(timeout);
          if (code === 0) resolve({ stdout, stderr });
          else {
            const diagnostic = [stderr.trim(), stdout.trim().split(/\r?\n/).slice(-8).join("\n")].filter(Boolean).join("\n");
            reject(new Error(`Codex exited with code ${String(code)}: ${diagnostic || "no diagnostic output"}`));
          }
        });
        child.stdin.end(invocation.prompt, "utf8");
      });

      const finalMessage = await readFile(outputPath, "utf8");
      let response: unknown;
      try {
        response = JSON.parse(finalMessage);
      } catch {
        throw new Error("Codex returned a final message that was not valid JSON.");
      }
      return {
        response,
        trace: execution.stdout.split(/\r?\n/).filter(Boolean),
        stderr: execution.stderr,
        duration_ms: Math.round(performance.now() - started),
      };
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  }
}
