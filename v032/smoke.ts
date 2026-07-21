import { access, mkdtemp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createV03Contracts } from "../src/v03/contracts.js";
import { LocalContextEngine } from "../src/v032/context-engine.js";
import { V03Store } from "../src/v03/store.js";

if (process.platform !== "win32") throw new Error("V0.3.2 smoke is Windows-only.");
const root = path.resolve("."), temporary = await mkdtemp(path.join(os.tmpdir(), "kovacs-v032-smoke-")), project = path.join(temporary, "project");
await mkdir(project); let store: V03Store | null = null;
try {
  const contracts = await createV03Contracts(path.join(root, "contracts"));
  store = await V03Store.create(path.join(temporary, "data", "kovacs.db"), contracts);
  store.saveSetupDraft({ narrative: "I am an engineer building Kovacs, with 20 hours per week. I need stronger scope control and want to prove contextual judgment in 90 days." }, {
    schema_version: "0.3.0", mission_title: "Prove reliable contextual engineering judgment",
    mission_success_criteria: ["A validated local context loop exists", "Decisions are supported by sourced evidence"],
    weekly_outcome: "Ship the V0.3.2 context foundation", weekly_success_criteria: ["Automated release gate passes"],
    weekly_competencies: ["ai_systems", "testing_reliability"], rationale: "Turn practice into reviewable evidence.", warnings: [],
    interpreted_profile: {
      current_position: { value: "Engineer building Kovacs", source: "explicit", confidence: 0.98, rationale: "Directly stated." },
      available_hours_per_week: { value: 20, source: "explicit", confidence: 1, rationale: "Directly stated." },
      active_projects: { value: ["Kovacs"], source: "explicit", confidence: 0.98, rationale: "Directly stated." },
      growth_edges: { value: ["Scope control"], source: "explicit", confidence: 0.95, rationale: "Directly stated." },
      desired_outcome: { value: "Prove contextual judgment", source: "explicit", confidence: 0.95, rationale: "Directly stated." },
    }, assumptions: [], clarification_questions: [],
  });
  store.confirmSetup(store.snapshot().pending_setup!.draft_id, "Become an Elite AI Systems Staff Engineer");
  store.saveDayDraft(project, "Finish the context foundation", { schema_version: "0.3.0", proposed_objective: "Validate V0.3.2 context and memory foundations", objective_changed: true, success_criteria: ["Smoke passes"], checkpoints: [{ title: "Exercise context", evidence_required: "Sanitized context frame", competency: "ai_systems" }, { title: "Exercise End Day", evidence_required: "Confirmed structured proposal", competency: "execution_ownership" }], rationale: "Bounded proof.", warnings: [] });
  const day = store.startDay(store.snapshot().pending_day!.draft_id, "ambient_v032_smoke");
  const engine = new LocalContextEngine();
  const frame = engine.analyze({ application: "Code.exe", windowTitle: "secret-client - controller.ts", project, activeCheckpoint: day.checkpoints[0]!.title, accessibilityText: "test controller.ts failing assertion", ocrText: "Error expected true", previous: null });
  store.recordContextFrame(frame, { kind: "checkpoint", occurred_at: new Date().toISOString(), context_id: frame.context_id,
    reference_id: day.checkpoints[0]!.checkpoint_id, retention_class: "event" });
  store.recordContextDecision({ occurred_at: new Date().toISOString(), context_id: frame.context_id, application: frame.application,
    confidence: frame.confidence, perception_path: "uia_ocr", decision: "call", reason: "deterministic_trigger",
    changed_fields: frame.changed_fields, fingerprint: "a".repeat(64), semantic_fingerprint: "b".repeat(64),
    image_attached: false, bypass_global_cooldown: true });
  const memories = store.searchMemories("Kovacs contextual judgment", 3);
  const proposal = { schema_version: "0.3.2" as const, narrative_summary: "Context foundation was exercised locally.", outcome: "partially_achieved" as const, output_summary: "Local context frame and memory retrieval completed", validation_summary: "Smoke assertions inspect persisted sanitized state", evidence_source: "tool_verified" as const, lesson: "Persist derived context, not raw screen text", missing_proof: ["Native OCR acceptance remains a live check"], carry_forward: ["Run live OCR acceptance"], assumptions: [] };
  const draft = store.saveEndDayDraft(day.day_id, "I exercised context and memory, but native OCR still needs live acceptance.", proposal);
  const stillActive = store.getActiveDay()?.day_id === day.day_id;
  store.endDay(proposal);
  const backup = await store.createBackup(path.join(temporary, "backup")); await access(backup.database); await access(backup.export);
  const snapshot = store.snapshot();
  const checks = { schema: snapshot.recovery.schema_version_applied === "0.3.2", context_sanitized: !JSON.stringify(snapshot.recent_context).includes("secret-client") && frame.text_digest?.length === 64,
    vector_retrieval: memories.length > 0 && memories[0]!.provenance.startsWith("local-hybrid"), proposal_required: stillActive && draft.draft_id.startsWith("draft_"),
    end_confirmed: snapshot.active_day === null && snapshot.pending_end_day === null, diagnostics: snapshot.context_diagnostics.length === 1,
    backup: true, no_window_titles: snapshot.retention.persist_window_titles === false };
  console.log(JSON.stringify({ checks, context: frame, retrieval: memories.map((item) => ({ claim: item.memory.claim, score: item.score, provenance: item.provenance })) }, null, 2));
  if (Object.values(checks).some((value) => !value)) process.exitCode = 1;
} finally { store?.close(); await rm(temporary, { recursive: true, force: true }); }
