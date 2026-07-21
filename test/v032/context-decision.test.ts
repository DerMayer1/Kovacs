import assert from "node:assert/strict";
import test from "node:test";
import { AmbientContextDecisionEngine } from "../../src/v02/context-decision.js";
import type { AmbientLocalPerceptionResult, ActiveWindowInfo } from "../../src/v02/types.js";

const window: ActiveWindowInfo = { application: "Code.exe", title: "Kovacs" };
const perception = (overrides: Partial<AmbientLocalPerceptionResult> = {}): AmbientLocalPerceptionResult => ({
  context_id: "ctx_decision", occurred_at: "2026-07-21T12:00:00.000Z", context: "Working on the active checkpoint",
  fingerprint: "a".repeat(64), semantic_fingerprint: "b".repeat(64), confidence: 0.85, sufficient: true,
  conflicting: false, deterministic_trigger: false, changed_fields: ["activity"], screenshot: null,
  prompt_injection_detected: false, sensitive_content_detected: false, sensitive_categories: [], screenshot_blocked_reason: null,
  capture_used: false, ocr_used: false, ...overrides,
});

test("confidence gate stays silent for low, medium, and conflicting observations", () => {
  assert.equal(new AmbientContextDecisionEngine().evaluate(perception({ confidence: 0.64 }), window, false, "normal").reason, "low_confidence");
  assert.equal(new AmbientContextDecisionEngine().evaluate(perception({ confidence: 0.7 }), window, false, "normal").reason, "medium_confidence");
  assert.equal(new AmbientContextDecisionEngine().evaluate(perception({ conflicting: true }), window, false, "normal").reason, "conflicting_signals");
});

test("strong semantic deltas require two stable observations", () => {
  const engine = new AmbientContextDecisionEngine();
  assert.equal(engine.evaluate(perception(), window, false, "normal", 1_000).reason, "awaiting_stability");
  const stable = engine.evaluate(perception({ context_id: "ctx_decision_2" }), window, false, "normal", 4_000);
  assert.equal(stable.decision, "call"); assert.equal(stable.reason, "stable_strong_delta");
});

test("weak deltas never trigger a model call", () => {
  const engine = new AmbientContextDecisionEngine();
  const weak = perception({ changed_fields: ["text_digest"] });
  assert.equal(engine.evaluate(weak, window, false, "normal", 1_000).reason, "weak_delta");
  assert.equal(engine.evaluate({ ...weak, context_id: "ctx_weak_2", fingerprint: "c".repeat(64) }, window, false, "normal", 4_000).decision, "silence");
});

test("deterministic failures intervene immediately but respect same-context cooldown", () => {
  const engine = new AmbientContextDecisionEngine();
  const failure = perception({ deterministic_trigger: true });
  const first = engine.evaluate(failure, window, false, "important", 1_000);
  assert.equal(first.reason, "deterministic_trigger"); assert.equal(first.bypass_global_cooldown, true);
  engine.recordIntervention("req_failure", failure, 1_000);
  assert.equal(engine.evaluate({ ...failure, context_id: "ctx_failure_2" }, window, false, "important", 2_000).reason, "same_context_cooldown");
});

test("manual observation overrides confidence while wrong-context feedback suppresses repetition", () => {
  const engine = new AmbientContextDecisionEngine();
  const uncertain = perception({ confidence: 0.2, conflicting: true });
  const manual = engine.evaluate(uncertain, window, true, "critical", 1_000);
  assert.equal(manual.decision, "call"); assert.equal(manual.reason, "manual");
  engine.recordIntervention("req_wrong", uncertain, 1_000); engine.recordFeedback("req_wrong", "wrong_context");
  assert.equal(engine.evaluate({ ...uncertain, context_id: "ctx_wrong_2", conflicting: false, confidence: 0.9 }, window, false, "normal", 2_000).reason, "suppressed_by_feedback");
});

test("working context expires after its TTL", () => {
  const engine = new AmbientContextDecisionEngine(1_000, 60_000);
  assert.equal(engine.evaluate(perception(), window, false, "normal", 100).reason, "awaiting_stability");
  assert.equal(engine.evaluate({ ...perception(), context_id: "ctx_after_ttl" }, window, false, "normal", 1_200).reason, "awaiting_stability");
});
