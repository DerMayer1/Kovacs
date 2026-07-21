import type { ActiveWindowInfo, CapturedFrame } from "../v02/types.js";
import type { ContextFrame } from "../v03/types.js";
import { LocalContextEngine } from "./context-engine.js";
import type { LocalPerceptionAdapter } from "./windows-perception.js";

export interface PerceptionCascadeInput {
  window: ActiveWindowInfo;
  project: string | null;
  activeCheckpoint: string | null;
  previous: ContextFrame | null;
  capture: () => Promise<CapturedFrame | null>;
}

export interface PerceptionCascadeResult {
  frame: ContextFrame;
  fingerprint: string;
  screenshot: Buffer | null;
  capture_used: boolean;
  ocr_used: boolean;
  failures: Array<"accessibility_unavailable" | "ocr_unavailable">;
}

export class PerceptionCascade {
  constructor(private readonly perception: LocalPerceptionAdapter, private readonly context: LocalContextEngine) {}

  async observe(input: PerceptionCascadeInput): Promise<PerceptionCascadeResult> {
    const accessibility = await this.perception.readAccessibility(input.window);
    const failures: PerceptionCascadeResult["failures"] = accessibility.failure ? [accessibility.failure] : [];
    let frame = this.context.analyze({ application: input.window.application, windowTitle: input.window.title,
      project: input.project, activeCheckpoint: input.activeCheckpoint, accessibilityText: accessibility.text,
      ocrText: "", previous: input.previous });
    if (this.context.isSufficient(frame)) return { frame, fingerprint: this.context.fingerprint(frame), screenshot: null, capture_used: false, ocr_used: false, failures };

    const captured = await input.capture();
    if (!captured) throw new Error("Local perception could not capture the authorized window for OCR fallback.");
    const ocr = await this.perception.readOcr(captured.png);
    if (ocr.failure) failures.push(ocr.failure);
    frame = this.context.analyze({ application: input.window.application, windowTitle: input.window.title,
      project: input.project, activeCheckpoint: input.activeCheckpoint, accessibilityText: accessibility.text,
      ocrText: ocr.text, previous: input.previous });
    const sufficient = this.context.isSufficient(frame);
    return { frame, fingerprint: this.context.fingerprint(frame), screenshot: sufficient ? null : captured.png,
      capture_used: true, ocr_used: true, failures };
  }
}
