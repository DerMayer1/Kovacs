import { createHash, randomUUID } from "node:crypto";
import type { ContextFrame, MemoryRetrievalResult } from "../v03/types.js";

export interface ContextObservation {
  occurredAt?: string;
  application: string;
  windowTitle: string;
  project: string | null;
  activeCheckpoint: string | null;
  accessibilityText: string;
  ocrText: string;
  privacyClassification?: ContextFrame["privacy_classification"];
  promptInjectionDetected?: boolean;
  previous?: ContextFrame | null;
}

const normalize = (value: string): string => value.replaceAll(/\s+/g, " ").trim();
const digest = (value: string): string | null => value ? createHash("sha256").update(value, "utf8").digest("hex") : null;
const filename = (value: string): string | null => value.match(/(?:^|\s|[\\/])([\w.-]+\.(?:ts|tsx|js|jsx|py|go|rs|java|cs|json|md|txt|docx|pdf|xlsx|pptx|yml|yaml))(?:\s|$|[):,])/i)?.[1] ?? null;

function classify(text: string): { activity: string; intent: string } {
  const lower = text.toLowerCase();
  if (/test|spec|assert|coverage|failing/.test(lower)) return { activity: "testing", intent: "Validate behavior and isolate failures" };
  if (/exception|stack trace|error|debug|diagnos/.test(lower)) return { activity: "debugging", intent: "Diagnose a concrete failure" };
  if (/curr[ií]culo|resume|job|vaga|application/.test(lower)) return { activity: "career_material", intent: "Improve a professional application artifact" };
  if (/cliente|client|proposal|scope|invoice/.test(lower)) return { activity: "client_work", intent: "Respond clearly in a client context" };
  if (/readme|documentation|docs|design doc|rfc/.test(lower)) return { activity: "documentation", intent: "Clarify or document an engineering decision" };
  if (/function|class|interface|const |import |def |public |private /.test(lower)) return { activity: "implementation", intent: "Implement or revise software" };
  if (/search|research|documentation|reference/.test(lower)) return { activity: "research", intent: "Gather information for the active objective" };
  return { activity: "general_work", intent: "Advance the active checkpoint" };
}

export class LocalContextEngine {
  analyze(input: ContextObservation): ContextFrame {
    const accessibility = normalize(input.accessibilityText).slice(0, 12_000);
    const ocr = normalize(input.ocrText).slice(0, 12_000);
    const transient = normalize(`${input.windowTitle} ${accessibility} ${ocr}`);
    const classified = classify(transient), accessibilityClass = classify(accessibility), ocrClass = classify(ocr);
    const artifact = filename(transient);
    const sources: ContextFrame["signal_sources"] = ["active_window", "operating_state"];
    if (accessibility) sources.push("accessibility");
    if (ocr) sources.push("ocr");
    const ambiguity: string[] = [];
    if (!accessibility && !ocr) ambiguity.push("No local text signal was available; context is based on active-window metadata and operating state.");
    if (!artifact) ambiguity.push("No specific artifact was confidently identified.");
    if (input.promptInjectionDetected) ambiguity.push("Untrusted instruction-like content was detected in the observed surface.");
    const conflicting = Boolean(accessibility && ocr && accessibilityClass.activity !== "general_work" && ocrClass.activity !== "general_work" && accessibilityClass.activity !== ocrClass.activity);
    if (conflicting) ambiguity.push(`Conflicting local signals: accessibility suggests ${accessibilityClass.activity} while OCR suggests ${ocrClass.activity}.`);
    const confidence = Math.max(0.1, Math.min(0.95, 0.35 + (accessibility ? 0.38 : 0) + (ocr ? 0.25 : 0) + (input.activeCheckpoint ? 0.1 : 0) - (conflicting ? 0.25 : 0) - (input.promptInjectionDetected ? 0.3 : 0)));
    const current = { application: input.application, project: input.project, activity: classified.activity,
      artifact, visible_intent: classified.intent, active_checkpoint: input.activeCheckpoint };
    const changedFields = Object.entries(current).filter(([key, value]) => input.previous ? input.previous[key as keyof ContextFrame] !== value : true).map(([key]) => key);
    return { schema_version: "0.3.2", context_id: `ctx_${randomUUID().replaceAll("-", "")}`,
      occurred_at: input.occurredAt ?? new Date().toISOString(), application: input.application,
      project: input.project, activity: classified.activity, artifact, visible_intent: classified.intent,
      active_checkpoint: input.activeCheckpoint, privacy_classification: input.privacyClassification ?? "authorized",
      confidence, ambiguity, signal_sources: sources, changed_fields: changedFields,
      text_digest: digest(normalize(`${accessibility}\n${ocr}`)) };
  }

  isSufficient(frame: ContextFrame): boolean {
    if (frame.privacy_classification !== "authorized" || !frame.text_digest) return false;
    const accessibility = frame.signal_sources.includes("accessibility"), ocr = frame.signal_sources.includes("ocr");
    const minimumConfidence = ocr && !accessibility ? 0.7 : 0.8;
    if (frame.confidence + Number.EPSILON < minimumConfidence) return false;
    return frame.activity !== "general_work" || frame.artifact !== null;
  }

  fingerprint(frame: ContextFrame): string {
    return createHash("sha256").update(JSON.stringify({ application: frame.application, project: frame.project,
      activity: frame.activity, artifact: frame.artifact, visible_intent: frame.visible_intent,
      active_checkpoint: frame.active_checkpoint, privacy_classification: frame.privacy_classification,
      text_digest: frame.text_digest }), "utf8").digest("hex");
  }

  semanticFingerprint(frame: ContextFrame): string {
    return createHash("sha256").update(JSON.stringify({ application: frame.application, project: frame.project,
      activity: frame.activity, artifact: frame.artifact, visible_intent: frame.visible_intent,
      active_checkpoint: frame.active_checkpoint, privacy_classification: frame.privacy_classification }), "utf8").digest("hex");
  }

  hasConflict(frame: ContextFrame): boolean { return frame.ambiguity.some((item) => item.startsWith("Conflicting local signals:")); }

  hasDeterministicTrigger(accessibilityText: string, ocrText: string): boolean {
    return /\b(error|exception|traceback|assert(?:ion)? failed|test(?:s)? failed|failing test|build failed|fatal)\b/i.test(`${accessibilityText}\n${ocrText}`);
  }

  summarize(frame: ContextFrame, memories: MemoryRetrievalResult[]): string {
    const recalled = memories.slice(0, 3).map((item) => `- ${item.memory.claim} [${item.provenance}; score=${item.score.toFixed(2)}]`).join("\n");
    return [
      "LOCAL CONTEXT ENGINE (derived from untrusted transient signals)",
      `Activity: ${frame.activity}; intent: ${frame.visible_intent}; artifact: ${frame.artifact ?? "unknown"}; confidence: ${frame.confidence.toFixed(2)}`,
      `Active checkpoint: ${frame.active_checkpoint ?? "none"}`,
      frame.ambiguity.length ? `Ambiguity: ${frame.ambiguity.join(" ")}` : "Ambiguity: none detected",
      recalled ? `Approved local memory retrieved:\n${recalled}` : "Approved local memory retrieved: none",
    ].join("\n");
  }
}
