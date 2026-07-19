import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { KovacsDatabase } from "../src/memory/database.js";

test("persists observations and sourced memories", (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "kovacs-test-"));
  const database = new KovacsDatabase(path.join(directory, "test.db"));
  context.after(() => {
    database.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  database.initialize();

  const observation = database.addObservation({
    kind: "test_failed",
    source: "test_runner",
    summary: "Expected one job but received two",
  });
  const memory = database.upsertMemory({
    namespace: "goal",
    key: "target_role",
    content: "Staff Software Engineer",
    source: "lucas",
    confidence: 1,
  });

  assert.equal(observation.id, 1);
  assert.equal(database.recentObservations()[0]?.summary, observation.summary);
  assert.equal(memory.source, "lucas");
  assert.equal(database.status().observations, 1);
  assert.equal(database.status().memories, 1);
});
