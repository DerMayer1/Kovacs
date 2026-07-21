import type { AmbientContextDecision, AmbientEvent, AmbientLocalPerceptionResult, ActiveWindowInfo } from "./types.js";

const STRONG_FIELDS = new Set(["application", "project", "activity", "artifact", "active_checkpoint"]);

export class AmbientContextDecisionEngine {
  private candidateSemanticFingerprint: string | null = null;
  private candidateSamples = 0;
  private candidateStrongDelta = false;
  private candidateFields = new Set<string>();
  private lastContentFingerprint: string | null = null;
  private lastObservedAt = 0;
  private readonly lastAdviceBySemanticFingerprint = new Map<string, number>();
  private readonly requestFingerprints = new Map<string, string>();
  private readonly suppressedFingerprints = new Set<string>();

  constructor(private readonly workingTtlMs = 10 * 60_000, private readonly sameContextCooldownMs = 60_000) {}

  reset(): void {
    this.candidateSemanticFingerprint = null; this.candidateSamples = 0; this.candidateStrongDelta = false;
    this.candidateFields.clear(); this.lastContentFingerprint = null; this.lastObservedAt = 0;
    this.lastAdviceBySemanticFingerprint.clear(); this.requestFingerprints.clear(); this.suppressedFingerprints.clear();
  }

  private expireWorkingContext(at: number): void {
    if (this.lastObservedAt && at - this.lastObservedAt > this.workingTtlMs) {
      this.candidateSemanticFingerprint = null; this.candidateSamples = 0; this.candidateStrongDelta = false;
      this.candidateFields.clear(); this.lastContentFingerprint = null;
    }
    this.lastObservedAt = at;
  }

  evaluate(perception: AmbientLocalPerceptionResult, window: ActiveWindowInfo, manual: boolean, urgency: AmbientEvent["urgency"], at = Date.now()): AmbientContextDecision {
    this.expireWorkingContext(at);
    const semanticChanged = perception.semantic_fingerprint !== this.candidateSemanticFingerprint;
    if (semanticChanged) {
      this.candidateSemanticFingerprint = perception.semantic_fingerprint; this.candidateSamples = 1;
      this.candidateFields = new Set(perception.changed_fields);
      this.candidateStrongDelta = perception.changed_fields.some((field) => STRONG_FIELDS.has(field));
    } else {
      this.candidateSamples += 1;
      for (const field of perception.changed_fields) this.candidateFields.add(field);
      this.candidateStrongDelta ||= perception.changed_fields.some((field) => STRONG_FIELDS.has(field));
    }
    const contentChanged = perception.fingerprint !== this.lastContentFingerprint;
    const newlyStable = this.candidateSamples === 2;
    this.lastContentFingerprint = perception.fingerprint;
    const base = { occurred_at: new Date(at).toISOString(), context_id: perception.context_id, application: window.application,
      confidence: perception.confidence, perception_path: perception.screenshot ? "uia_ocr_screenshot" as const : perception.ocr_used ? "uia_ocr" as const : "uia" as const,
      changed_fields: [...this.candidateFields], fingerprint: perception.fingerprint,
      semantic_fingerprint: perception.semantic_fingerprint, image_attached: Boolean(perception.screenshot) };
    const result = (decision: AmbientContextDecision["decision"], reason: AmbientContextDecision["reason"], bypass = false): AmbientContextDecision => ({ ...base, decision, reason, bypass_global_cooldown: bypass });

    if (manual) return result("call", "manual", true);
    if (this.suppressedFingerprints.has(perception.semantic_fingerprint)) return result("silence", "suppressed_by_feedback");
    if (perception.conflicting) return result("silence", "conflicting_signals");
    if (perception.confidence < 0.65) return result("silence", "low_confidence");
    if (perception.confidence < 0.8 && !(perception.deterministic_trigger && perception.screenshot)) return result("silence", "medium_confidence");
    if (perception.deterministic_trigger && (perception.confidence >= 0.8 || perception.screenshot)) {
      const lastAdvice = this.lastAdviceBySemanticFingerprint.get(perception.semantic_fingerprint) ?? 0;
      if (!contentChanged && at - lastAdvice < this.sameContextCooldownMs) return result("silence", "same_context_cooldown");
      return result("call", "deterministic_trigger", true);
    }
    if (!contentChanged && !newlyStable) return result("silence", "unchanged");
    if (!this.candidateStrongDelta) return result("silence", "weak_delta");
    if (this.candidateSamples < 2) return result("silence", "awaiting_stability");
    const lastAdvice = this.lastAdviceBySemanticFingerprint.get(perception.semantic_fingerprint) ?? 0;
    if (lastAdvice && at - lastAdvice < this.sameContextCooldownMs) return result("silence", "same_context_cooldown");
    const structuralBreak = [...this.candidateFields].some((field) => field === "project" || field === "application" || field === "active_checkpoint");
    return result("call", "stable_strong_delta", structuralBreak || urgency === "critical");
  }

  recordIntervention(requestId: string, perception: AmbientLocalPerceptionResult, at = Date.now()): void {
    this.lastAdviceBySemanticFingerprint.set(perception.semantic_fingerprint, at);
    this.requestFingerprints.set(requestId, perception.semantic_fingerprint);
    this.candidateStrongDelta = false; this.candidateFields.clear();
  }

  recordFeedback(requestId: string, kind: string): string | null {
    const fingerprint = this.requestFingerprints.get(requestId) ?? null;
    if (fingerprint && kind === "wrong_context") this.suppressedFingerprints.add(fingerprint);
    return fingerprint;
  }
}
