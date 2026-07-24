# V0.3.0 Architecture

```text
User calibration
  -> Codex CLI structured setup proposal
  -> explicit confirmation
  -> 90-day mission + rolling week in local SQLite

Daily objective
  -> local validation and project canonicalization
  -> Codex CLI structured day proposal
  -> explicit confirmation
  -> V0.2 authorized observer starts
  -> current checkpoint becomes operating context
  -> local trigger policy decides silence or Codex coaching
  -> user records result + validation + assistance level
  -> evidence updates competency state
  -> explicit End Day
  -> V0.1 Debrief + structured day outcome + lesson
```

## Boundaries

- `src/application/operating-system/operating-system.ts` owns the lifecycle and confirmation boundary.
- `src/infrastructure/persistence/sqlite-operating-store.ts` owns SQLite migrations, plans, checkpoints, evidence, competence, memories, and usage telemetry.
- `src/application/planning/codex-planner.ts` owns schema-constrained setup, week, and day proposals through `codex exec`.
- `src/application/observation/observation-controller.ts` owns capture and ambient-intervention orchestration. The operating system supplies only a compact structured context summary and receives telemetry.
- `src/core/coaching/` and `src/application/coaching/` contain the coaching, privacy, assistance, and read-only execution kernel.
- `ui/desktop/` is presentation only. Its sandboxed preload exposes a fixed command surface and no filesystem, process, or arbitrary IPC capability.

The current responsibility-based module boundaries are normative in
[`docs/ARCHITECTURE.md`](../ARCHITECTURE.md). Version numbers remain only in
schemas, migrations, release documentation, and release gates.

## Codex boundary

Planning and coaching use ephemeral `codex exec` processes with ignored user configuration, read-only sandboxing, approval denied, web disabled, and JSON Schema output. Screen images use invocation-scoped `--image` attachments and are deleted in `finally`.

Setup, week, and day planning have separate response schemas. Untrusted learner, project, and visual context is clearly delimited and cannot grant instructions or authority.

## Local database

`%LOCALAPPDATA%\Kovacs\v0.3\kovacs.db` contains:

- confirmed operating profile;
- pending proposals;
- daily plans and checkpoints;
- sourced evidence;
- derived competency state;
- editable memory records;
- model-invocation telemetry.

Ambient JSON and V0.1 session audits remain in versioned subdirectories. The target project receives no Kovacs state.

## Failure behavior

- A planning failure creates no confirmed plan.
- A rejected or malformed model response fails closed at schema validation.
- If daily confirmation cannot be persisted after observation starts, observation is immediately paused.
- Restart recovery never resumes observation automatically.
- Private and paused states produce no capture.
- A model failure cannot turn into an action request.
