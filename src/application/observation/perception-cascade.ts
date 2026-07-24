import type { ActiveWindowInfo, CapturedFrame } from "../../core/observation/types.js";
import type { ContextFrame } from "../../core/operating-system/types.js";
import { LocalContextEngine } from "../../core/context/context-engine.js";
import type { LocalPerceptionAdapter } from "../../infrastructure/windows/windows-perception.js";
import { LocalSensitiveContentGuard } from "../../core/security/local-sensitive-content-guard.js";
import type { SensitiveContentCategory } from "../../core/security/sensitive-content.js";

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
  semantic_fingerprint: string;
  screenshot: Buffer | null;
  capture_used: boolean;
  ocr_used: boolean;
  conflicting: boolean;
  deterministic_trigger: boolean;
  prompt_injection_detected: boolean;
  sensitive_content_detected: boolean;
  sensitive_categories: SensitiveContentCategory[];
  screenshot_blocked_reason: "sensitive_content" | "ocr_unavailable" | null;
  failures: Array<"accessibility_unavailable" | "ocr_unavailable">;
}

export class PerceptionCascade {
  constructor(private readonly perception: LocalPerceptionAdapter, private readonly context: LocalContextEngine,
    private readonly guard = new LocalSensitiveContentGuard()) {}

  async observe(input: PerceptionCascadeInput): Promise<PerceptionCascadeResult> {
    const accessibility = await this.perception.readAccessibility(input.window);
    const guardedTitle = this.guard.inspect(input.window.title), guardedAccessibility = this.guard.inspect(accessibility.text);
    const initialSensitive = new Set([...guardedTitle.sensitive_categories, ...guardedAccessibility.sensitive_categories]);
    const initialInjection = guardedTitle.prompt_injection_detected || guardedAccessibility.prompt_injection_detected;
    const failures: PerceptionCascadeResult["failures"] = accessibility.failure ? [accessibility.failure] : [];
    let frame = this.context.analyze({ application: input.window.application, windowTitle: guardedTitle.text,
      project: input.project, activeCheckpoint: input.activeCheckpoint, accessibilityText: guardedAccessibility.text,
      ocrText: "", promptInjectionDetected: initialInjection, previous: input.previous });
    const accessibilityTrigger = this.context.hasDeterministicTrigger(guardedAccessibility.text, "");
    if (this.context.isSufficient(frame)) return { frame, fingerprint: this.context.fingerprint(frame), semantic_fingerprint: this.context.semanticFingerprint(frame),
      screenshot: null, capture_used: false, ocr_used: false, conflicting: this.context.hasConflict(frame), deterministic_trigger: accessibilityTrigger,
      prompt_injection_detected: initialInjection, sensitive_content_detected: initialSensitive.size > 0,
      sensitive_categories: [...initialSensitive], screenshot_blocked_reason: null, failures };

    const captured = await input.capture();
    if (!captured) throw new Error("Local perception could not capture the authorized window for OCR fallback.");
    const ocr = await this.perception.readOcr(captured.png);
    const guardedOcr = this.guard.inspect(ocr.text);
    const sensitive = new Set([...initialSensitive, ...guardedOcr.sensitive_categories]);
    const promptInjection = initialInjection || guardedOcr.prompt_injection_detected;
    if (ocr.failure) failures.push(ocr.failure);
    frame = this.context.analyze({ application: input.window.application, windowTitle: guardedTitle.text,
      project: input.project, activeCheckpoint: input.activeCheckpoint, accessibilityText: guardedAccessibility.text,
      ocrText: guardedOcr.text, promptInjectionDetected: promptInjection, previous: input.previous });
    const sufficient = this.context.isSufficient(frame), deterministicTrigger = this.context.hasDeterministicTrigger(guardedAccessibility.text, guardedOcr.text);
    const wantsScreenshot = !sufficient || (deterministicTrigger && frame.confidence < 0.8);
    const screenshotBlockedReason = wantsScreenshot ? sensitive.size ? "sensitive_content" as const : ocr.failure ? "ocr_unavailable" as const : null : null;
    return { frame, fingerprint: this.context.fingerprint(frame), semantic_fingerprint: this.context.semanticFingerprint(frame),
      screenshot: wantsScreenshot && !screenshotBlockedReason ? captured.png : null,
      capture_used: true, ocr_used: true, conflicting: this.context.hasConflict(frame), deterministic_trigger: deterministicTrigger,
      prompt_injection_detected: promptInjection, sensitive_content_detected: sensitive.size > 0,
      sensitive_categories: [...sensitive], screenshot_blocked_reason: screenshotBlockedReason, failures };
  }
}
