import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import type { ActiveWindowInfo } from "../v02/types.js";

const execFileAsync = promisify(execFile);

export interface PerceptionSample {
  accessibilityText: string;
  ocrText: string;
  failures: string[];
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

  async observe(window: ActiveWindowInfo, imagePath: string): Promise<PerceptionSample> {
    const failures: string[] = [];
    const accessibility = window.windowId
      ? this.run("windows-uia.ps1", [String(window.windowId)]).catch((error: unknown) => { failures.push(`accessibility:${(error as Error).message.slice(0, 160)}`); return ""; })
      : Promise.resolve("");
    const ocr = this.run("windows-ocr.ps1", [imagePath]).catch((error: unknown) => { failures.push(`ocr:${(error as Error).message.slice(0, 160)}`); return ""; });
    const [accessibilityText, ocrText] = await Promise.all([accessibility, ocr]);
    return { accessibilityText, ocrText, failures };
  }
}
