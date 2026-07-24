import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { ActiveWindowInfo } from "../../core/observation/types.js";

const execFileAsync = promisify(execFile);

export interface LocalTextSignal {
  text: string;
  failure: "accessibility_unavailable" | "ocr_unavailable" | null;
}

export interface LocalPerceptionAdapter {
  readAccessibility(window: ActiveWindowInfo): Promise<LocalTextSignal>;
  readOcr(png: Buffer): Promise<LocalTextSignal>;
}

const compact = (value: string): string => value.replaceAll(/\s+/g, " ").trim().slice(0, 12_000);

export class WindowsPerception {
  constructor(private readonly scriptsDirectory: string, private readonly timeoutMs = 8_000) {}

  private async run(script: string, args: string[]): Promise<string> {
    if (process.platform !== "win32") return "";
    const result = await execFileAsync("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", path.join(this.scriptsDirectory, script), ...args], {
      windowsHide: true, timeout: this.timeoutMs, maxBuffer: 512 * 1024, encoding: "utf8",
    });
    return compact(result.stdout);
  }

  async readAccessibility(window: ActiveWindowInfo): Promise<LocalTextSignal> {
    if (!window.windowId) return { text: "", failure: "accessibility_unavailable" };
    try { return { text: await this.run("windows-uia.ps1", [String(window.windowId)]), failure: null }; }
    catch { return { text: "", failure: "accessibility_unavailable" }; }
  }

  async readOcr(png: Buffer): Promise<LocalTextSignal> {
    const temporary = await mkdtemp(path.join(os.tmpdir(), "kovacs-local-ocr-"));
    const imagePath = path.join(temporary, "authorized-window.png");
    try {
      await writeFile(imagePath, png, { flag: "wx" });
      return { text: await this.run("windows-ocr.ps1", [imagePath]), failure: null };
    } catch { return { text: "", failure: "ocr_unavailable" }; }
    finally { await rm(temporary, { recursive: true, force: true }); }
  }
}
