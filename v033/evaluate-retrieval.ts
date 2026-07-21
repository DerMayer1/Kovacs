import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createV03Contracts } from "../src/v03/contracts.js";
import { V03Store } from "../src/v03/store.js";
import type { MemoryCandidate } from "../src/v01/types.js";

interface RetrievalCase { query: string; expected_claim: string; }

const root = path.resolve(".");
const cases = JSON.parse(await readFile(path.join(root, "benchmarks", "v0.3.3", "retrieval-cases.json"), "utf8")) as RetrievalCase[];
assert.ok(cases.length >= 10, "The retrieval benchmark requires at least ten cases.");

const directory = await mkdtemp(path.join(os.tmpdir(), "kovacs-v033-retrieval-"));
const contracts = await createV03Contracts(path.join(root, "contracts"));
const store = await V03Store.create(path.join(directory, "kovacs.db"), contracts);
const project = path.join(root, "benchmark-project");

try {
  const candidates: MemoryCandidate[] = cases.map((item, index) => ({
    candidate_id: `candidate_v033_${String(index).padStart(2, "0")}`,
    memory_type: index % 3 === 0 ? "semantic" : "pattern",
    claim: item.expected_claim,
    epistemic_status: "verified",
    source_event_ids: [`benchmark_v033_${index}`],
    confidence: 0.95,
    sensitivity: "internal",
    retention: "until_review",
    expires_at: null,
    evidence_reference: null,
    requires_confirmation: false,
    policy_version: "v0.1.0",
  }));
  candidates.push({ candidate_id: "candidate_v033_distractor", memory_type: "pattern",
    claim: "An unrelated project uses a different release ritual and must not enter this context.", epistemic_status: "verified",
    source_event_ids: ["benchmark_v033_distractor"], confidence: 1, sensitivity: "internal", retention: "until_review",
    expires_at: null, evidence_reference: null, requires_confirmation: false, policy_version: "v0.1.0" });
  store.ingestMemoryCandidates(candidates.slice(0, -1), null, null, project);
  store.ingestMemoryCandidates(candidates.slice(-1), null, null, path.join(root, "other-project"));

  const evaluations = cases.map((item) => {
    const results = store.searchMemories({ text: item.query, project, kinds: ["pattern", "context"], maximum_sensitivity: "internal", limit: 5 });
    return { query: item.query, hit: results.some((result) => result.memory.claim === item.expected_claim),
      top: results.map((result) => ({ claim: result.memory.claim, score: Number(result.score.toFixed(4)), path: result.retrieval_path })) };
  });
  const hits = evaluations.filter((item) => item.hit).length, recallAtFive = hits / evaluations.length;
  process.stdout.write(`${JSON.stringify({ cases: evaluations.length, hits, recall_at_5: recallAtFive, threshold: 0.8, evaluations }, null, 2)}\n`);
  assert.ok(recallAtFive >= 0.8, `Top-5 recall ${recallAtFive.toFixed(2)} is below 0.80.`);
} finally {
  store.close(); await rm(directory, { recursive: true, force: true });
}
