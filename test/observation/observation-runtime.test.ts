import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createObservationContracts } from "../../src/infrastructure/contracts/observation-contracts.js";
import { defaultAmbientSettings } from "../../src/infrastructure/config/observation-config.js";
import { ObservationStateStore } from "../../src/infrastructure/persistence/observation-state-store.js";
import { ObservationController } from "../../src/application/observation/observation-controller.js";
import { authorizeWindow } from "../../src/core/observation/window-authorization.js";
import { frameDifference, isMeaningfulFrameChange } from "../../src/core/observation/change-detector.js";
import { automaticInterventionAllowed } from "../../src/core/observation/intervention-policy.js";
import type { ActiveWindowInfo, FrameCapture, WindowProbe } from "../../src/core/observation/types.js";
import type { KovacsService } from "../../src/application/coaching/coaching-service.js";
import type { Profile, ProfileResponse, SessionRecord } from "../../src/core/coaching/types.js";

const root = path.resolve(".");
const activeWindow: ActiveWindowInfo = { application: "Code.exe", title: "controller.ts - Kovacs", windowId: 42 };

class FakeService {
  calls: Array<{ profile: Profile; imagePaths: string[] }> = [];
  async start(project: string, task: string): Promise<SessionRecord> {
    return { schema_version: "0.1.0", session_id: "ses_v02_test", project: path.resolve(project), task, mode: "training", status: "active", started_at: new Date().toISOString(), ended_at: null, events: [] };
  }
  async intervene(_sessionId: string, profile: Profile, input: { imagePaths?: string[] }): Promise<{ response: ProfileResponse; cached: false; redaction_count: 0; context_truncated: false; gateway_duration_ms: 1 }> {
    for (const imagePath of input.imagePaths ?? []) await access(imagePath);
    this.calls.push({ profile, imagePaths: [...(input.imagePaths ?? [])] });
    return { response: {
      schema_version: "0.1.0", request_id: `req_${profile}_${this.calls.length}`, profile, recommendation: "display",
      assessment: "The current screen provides enough authorized evidence for one bounded intervention.",
      intervention: { type: profile === "debrief" ? "debrief" : "hint", message: "Verify the smallest relevant behavior before expanding the change.", assistance_level: "A2", contains_complete_solution: false },
      reason: "The intervention stays tied to the active objective.", observed_context: ["Authorized VS Code window"], checkpoint: "Report the verification result.", memory_candidates: [], external_action_requests: [],
    }, cached: false, redaction_count: 0, context_truncated: false, gateway_duration_ms: 1 };
  }
}

async function setup() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "kovacs-v02-test-"));
  const project = path.join(directory, "project"); await mkdir(project);
  const contracts = await createObservationContracts(path.join(root, "contracts"));
  const store = new ObservationStateStore(path.join(directory, "data"), contracts);
  const service = new FakeService();
  let probes = 0, captures = 0;
  const windows: WindowProbe = { getActiveWindow: async () => { probes += 1; return activeWindow; } };
  const frames: FrameCapture = { capture: async () => { captures += 1; return { sample: Buffer.alloc(48 * 27 * 4, captures), png: Buffer.from("ephemeral-png") }; } };
  const settings = { ...defaultAmbientSettings(), automatic_intervention_interval_ms: 30000, frame_difference_threshold: 0.01 };
  const controller = new ObservationController(service as unknown as KovacsService, store, settings, windows, frames);
  await controller.initialize();
  return { directory, project, store, service, controller, counts: () => ({ probes, captures }), cleanup: () => rm(directory, { recursive: true, force: true }) };
}

test("authorization is application-allowlisted and title-deny-first", () => {
  const settings = defaultAmbientSettings();
  assert.equal(authorizeWindow(activeWindow, settings).allowed, true);
  assert.deepEqual(authorizeWindow({ ...activeWindow, title: "Bitwarden Password Vault" }, settings), { allowed: false, reason: "denied_title" });
  assert.deepEqual(authorizeWindow({ application: "Discord.exe", title: "Chat" }, settings), { allowed: false, reason: "unknown_application" });
});

test("frame comparison filters insignificant changes", () => {
  const base = Buffer.alloc(100, 20), same = Buffer.alloc(100, 20), changed = Buffer.alloc(100, 220);
  assert.equal(frameDifference(base, same), 0);
  assert.equal(isMeaningfulFrameChange(base, same, 0.1), false);
  assert.equal(isMeaningfulFrameChange(base, changed, 0.1), true);
});

test("automatic policy enforces disabled, busy, cooldown, and critical bypass", () => {
  const settings = defaultAmbientSettings(); const now = Date.now();
  assert.equal(automaticInterventionAllowed(settings, now, null, "normal", false), true);
  assert.equal(automaticInterventionAllowed(settings, now, new Date(now - 1000).toISOString(), "normal", false), false);
  assert.equal(automaticInterventionAllowed(settings, now, new Date(now - 1000).toISOString(), "critical", false), true);
  assert.equal(automaticInterventionAllowed(settings, now, null, "critical", true), false);
});

test("idle, pause, and private states capture nothing", async (t) => {
  const x = await setup(); t.after(x.cleanup);
  await x.controller.tick(); assert.deepEqual(x.counts(), { probes: 0, captures: 0 });
  await x.controller.startDay(x.project, "Implement the observer safely");
  await x.controller.setStatus("paused"); await x.controller.tick();
  await x.controller.setStatus("private"); await x.controller.tick();
  assert.deepEqual(x.counts(), { probes: 0, captures: 0 });
});

test("meaningful authorized change calls V0.1 and deletes the raw frame", async (t) => {
  const x = await setup(); t.after(x.cleanup);
  await x.controller.startDay(x.project, "Implement the observer safely");
  await x.controller.tick();
  assert.equal(x.service.calls.length, 1);
  const imagePath = x.service.calls[0]?.imagePaths[0]; assert.ok(imagePath);
  await assert.rejects(() => access(imagePath!));
  const state = x.controller.getState(); assert.equal(state?.events.some((event) => event.type === "intervention"), true);
  const persisted = await readFile(path.join(x.directory, "data", "current-day.json"), "utf8");
  assert.doesNotMatch(persisted, /ephemeral-png|active-window\.png|auth\.json/);
});

test("manual observation works only while observing", async (t) => {
  const x = await setup(); t.after(x.cleanup);
  await x.controller.startDay(x.project, "Review the active implementation");
  await x.controller.observeNow(); assert.equal(x.service.calls.length, 1);
  await x.controller.setStatus("paused");
  await assert.rejects(() => x.controller.observeNow(), /observing day/i);
});

test("Observe Now reuses only a recent authorized window after the pet receives focus", async (t) => {
  const x = await setup(); t.after(x.cleanup);
  let current: ActiveWindowInfo = activeWindow;
  const contracts = await createObservationContracts(path.join(root, "contracts"));
  const controller = new ObservationController(
    x.service as unknown as KovacsService,
    new ObservationStateStore(path.join(x.directory, "manual-data"), contracts),
    { ...defaultAmbientSettings(), automatic_interventions: false, manual_window_grace_ms: 30000 },
    { getActiveWindow: async () => current },
    { capture: async (window) => ({ sample: Buffer.alloc(64, 10), png: Buffer.from(`captured:${window.application}`) }) },
  );
  await controller.initialize(); await controller.startDay(x.project, "Test manual observation focus handoff");
  await controller.tick();
  current = { application: "electron.exe", title: "Kovacs V0.2" };
  await controller.observeNow();
  assert.equal(x.service.calls.length, 1);
});

test("End Day debriefs through V0.1 and ends capture", async (t) => {
  const x = await setup(); t.after(x.cleanup);
  await x.controller.startDay(x.project, "Complete one deliberate practice loop");
  await x.controller.endDay();
  assert.equal(x.service.calls.at(-1)?.profile, "debrief");
  assert.equal(x.controller.getState()?.status, "ended");
  const before = x.counts(); await x.controller.tick(); assert.deepEqual(x.counts(), before);
});

test("application recovery always pauses a previously observing day", async (t) => {
  const x = await setup(); t.after(x.cleanup);
  await x.controller.startDay(x.project, "Prove safe restart behavior");
  assert.equal(x.controller.getState()?.status, "observing");
  const contracts = await createObservationContracts(path.join(root, "contracts"));
  const recovered = new ObservationController(x.service as unknown as KovacsService, new ObservationStateStore(path.join(x.directory, "data"), contracts), defaultAmbientSettings(), { getActiveWindow: async () => activeWindow }, { capture: async () => null });
  await recovered.initialize();
  assert.equal(recovered.getState()?.status, "paused");
  assert.match(recovered.getState()?.events.at(-1)?.summary ?? "", /recovery/i);
});
