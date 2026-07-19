import assert from "node:assert/strict";
import test from "node:test";

import type { Observation } from "../src/domain/types.js";
import { evaluateObservation } from "../src/events/policy.js";

function observation(overrides: Partial<Observation> = {}): Observation {
  return {
    id: 1,
    occurredAt: new Date().toISOString(),
    kind: "manual",
    source: "test",
    summary: "Inspect now",
    payload: {},
    sensitivity: "normal",
    processedAt: null,
    ...overrides,
  };
}

test("manual observations always meet the default threshold", () => {
  const result = evaluateObservation(observation(), 0.65);
  assert.equal(result.shouldIntervene, true);
  assert.equal(result.score, 1);
});

test("window changes remain silent", () => {
  const result = evaluateObservation(
    observation({ kind: "window_changed" }),
    0.65,
  );
  assert.equal(result.shouldIntervene, false);
});

test("restricted observations never reach Codex", () => {
  const result = evaluateObservation(
    observation({ kind: "meeting_question", sensitivity: "restricted" }),
    0,
  );
  assert.equal(result.shouldIntervene, false);
  assert.match(result.reason, /never sent/i);
});
