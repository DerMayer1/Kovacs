# V0.2.0 Ambient Architecture

```text
Kovacs Pet (idle)
  -> explicit Start Day + objective
  -> active-day controller
  -> active-window authorization
  -> Electron desktop capture (memory only)
  -> local perceptual change detector
  -> deterministic event and urgency policy
  -> invocation-scoped PNG when reasoning is justified
  -> V0.1 Coach / Inspect / Debrief service
  -> schema and assistance validation
  -> pet intervention card
  -> structured audit event
  -> raw PNG deletion
```

## Processes

- Electron main process owns capture, active-window lookup, observation lifecycle, V0.1 calls, state persistence, and IPC authorization.
- Sandboxed renderer owns presentation only.
- Preload exposes a fixed, typed command surface. It exposes no filesystem, process, shell, or arbitrary IPC capability.
- Codex remains an ephemeral read-only subprocess with web disabled and approval denied.

## Observation policy

The observer samples only while status is `observing`. It checks the active window before requesting a thumbnail. Denied or unknown applications produce no frame. A small thumbnail bitmap is compared in memory; insignificant changes produce no event. A full invocation image is created only for a justified intervention and removed in `finally`.

## Intervention policy

- `normal`: meaningful authorized change after the normal observation interval;
- `important`: focus drift, repeated context, or user-requested inspection;
- `critical`: locally recognizable high-risk production language; immediate display and cooldown bypass, still advice-only;
- manual Observe Now: explicit A2 Coach call, subject to privacy authorization.

Only one reasoning call may run at a time. Automatic calls have a configurable minimum interval. Local sampling does not imply a model call.

Clicking the pet makes it the foreground window. `Observe Now` may therefore reuse the last authorized work window only within the configured short grace period. A denied or unknown window is never remembered as a fallback.

## Durable state

V0.2 stores objective, main goal, project, permissions, status transitions, structured window/event metadata, interventions, and the V0.1 session ID. It never stores bitmap bytes, screenshot paths, clipboard contents, raw browser contents, passwords, or raw audio.

## Extension ports

- caption source -> future Meeting Mode;
- job/career source -> future Career Mode;
- draft action queue -> future permissioned computer actions;
- approved routine/context memory -> future longitudinal learner model.
