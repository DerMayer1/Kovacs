import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { KovacsService } from "../../src/v01/service.js";
import type { Profile, ProfileResponse, SessionRecord } from "../../src/v01/types.js";
import { defaultAmbientSettings } from "../../src/v02/config.js";
import { createAmbientContracts } from "../../src/v02/contracts.js";
import { AmbientController } from "../../src/v02/controller.js";
import { AmbientStateStore } from "../../src/v02/state-store.js";
import type { ActiveWindowInfo, CapturedFrame } from "../../src/v02/types.js";
import { LocalContextEngine } from "../../src/v032/context-engine.js";
import { PerceptionCascade } from "../../src/v032/perception-cascade.js";
import type { LocalPerceptionAdapter, LocalTextSignal } from "../../src/v032/windows-perception.js";

const root = path.resolve(".");
const window: ActiveWindowInfo = { application: "Code.exe", title: "controller.ts", windowId: 42 };
const captured: CapturedFrame = { sample: Buffer.alloc(64, 120), png: Buffer.from("authorized-local-frame") };

class FakePerception implements LocalPerceptionAdapter {
  readonly events: string[] = [];
  constructor(private readonly accessibility: LocalTextSignal, private readonly ocr: LocalTextSignal) {}
  async readAccessibility(): Promise<LocalTextSignal> { this.events.push("uia"); return this.accessibility; }
  async readOcr(): Promise<LocalTextSignal> { this.events.push("ocr"); return this.ocr; }
}

const cascadeInput = (capture: () => Promise<CapturedFrame | null>) => ({ window, project: root,
  activeCheckpoint: "Diagnose the failing test", previous: null, capture });

test("sufficient UIA context performs zero capture, zero OCR, and zero screenshot attachment", async () => {
  const adapter = new FakePerception({ text: "failing test assertion in controller.ts", failure: null }, { text: "must not run", failure: null });
  const cascade = new PerceptionCascade(adapter, new LocalContextEngine()); let captures = 0;
  const result = await cascade.observe(cascadeInput(async () => { captures += 1; return captured; }));
  assert.deepEqual(adapter.events, ["uia"]); assert.equal(captures, 0); assert.equal(result.capture_used, false);
  assert.equal(result.ocr_used, false); assert.equal(result.screenshot, null);
});

test("a deterministic OCR failure may escalate the already captured frame to Codex", async () => {
  const adapter = new FakePerception({ text: "", failure: "accessibility_unavailable" }, { text: "failing test assertion in controller.ts", failure: null });
  const cascade = new PerceptionCascade(adapter, new LocalContextEngine()); let captures = 0;
  const result = await cascade.observe(cascadeInput(async () => { adapter.events.push("capture"); captures += 1; return captured; }));
  assert.deepEqual(adapter.events, ["uia", "capture", "ocr"]); assert.equal(captures, 1); assert.equal(result.capture_used, true);
  assert.equal(result.ocr_used, true); assert.deepEqual(result.screenshot, captured.png);
});

test("screenshot is returned only after both UIA and OCR remain insufficient", async () => {
  const adapter = new FakePerception({ text: "", failure: "accessibility_unavailable" }, { text: "", failure: "ocr_unavailable" });
  const cascade = new PerceptionCascade(adapter, new LocalContextEngine());
  const result = await cascade.observe(cascadeInput(async () => { adapter.events.push("capture"); return captured; }));
  assert.deepEqual(adapter.events, ["uia", "capture", "ocr"]); assert.equal(result.capture_used, true);
  assert.equal(result.ocr_used, true); assert.deepEqual(result.screenshot, captured.png);
});

class FakeService {
  readonly inputs: Array<{ imagePaths?: string[] }> = [];
  async start(project: string, task: string): Promise<SessionRecord> {
    return { schema_version: "0.1.0", session_id: "ses_lazy_perception", project: path.resolve(project), task, mode: "training", status: "active", started_at: new Date().toISOString(), ended_at: null, events: [] };
  }
  async intervene(_sessionId: string, profile: Profile, input: { imagePaths?: string[] }): Promise<{ response: ProfileResponse; cached: false; redaction_count: number; context_truncated: false; gateway_duration_ms: number; prompt_characters: number }> {
    for (const imagePath of input.imagePaths ?? []) await access(imagePath);
    this.inputs.push(input);
    return { response: { schema_version: "0.1.0", request_id: `req_lazy_${this.inputs.length}`, profile,
      recommendation: "display", assessment: "Local context is sufficient.", intervention: { type: "hint", message: "Validate the active checkpoint.", assistance_level: "A2", contains_complete_solution: false },
      reason: "Use the least invasive signal.", observed_context: ["Local context"], checkpoint: "Report validation.", memory_candidates: [], external_action_requests: [] },
      cached: false, redaction_count: 0, context_truncated: false, gateway_duration_ms: 5, prompt_characters: 100 };
  }
}

test("AmbientController does not capture or attach an image when local perception is sufficient", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "kovacs-lazy-ambient-")); t.after(() => rm(directory, { recursive: true, force: true }));
  const project = path.join(directory, "project"); await mkdir(project);
  const contracts = await createAmbientContracts(path.join(root, "contracts")), service = new FakeService(); let captures = 0, contextEvents = 0, clears = 0;
  const controller = new AmbientController(service as unknown as KovacsService, new AmbientStateStore(path.join(directory, "ambient"), contracts),
    { ...defaultAmbientSettings(), automatic_interventions: true }, { getActiveWindow: async () => window },
    { capture: async () => { captures += 1; return captured; } }, { localPerception: async () => ({
      context_id: "ctx_lazy", occurred_at: new Date().toISOString(), context: "Sufficient UIA context",
      fingerprint: "a".repeat(64), semantic_fingerprint: "b".repeat(64), confidence: 0.8, sufficient: true,
      conflicting: false, deterministic_trigger: true, changed_fields: ["activity"], screenshot: null,
      capture_used: false, ocr_used: false,
    }), onContextEvent: () => { contextEvents += 1; }, onWorkingContextCleared: () => { clears += 1; } });
  await controller.initialize(); await controller.startDay(project, "Prove lazy perception"); await controller.tick();
  assert.equal(captures, 0); assert.equal(service.inputs.length, 1); assert.equal(service.inputs[0]!.imagePaths, undefined);
  assert.equal(controller.getState()?.events.at(-1)?.frame_attached, false);
  await controller.tick(); assert.equal(service.inputs.length, 1);
  assert.equal(contextEvents, 1); await controller.setStatus("paused"); assert.equal(clears, 2);
});
