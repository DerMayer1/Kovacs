# V0.2.0 Success Metrics

Status: normative

## Automated gate

- M01: all normative V0.2 artifacts exist.
- M02: ambient state, event, and settings fixtures validate 100%.
- M03: Start Day requires an existing project and non-empty objective.
- M04: capture is impossible in idle, paused, private, or ended state.
- M05: denied and unknown applications produce zero captures.
- M06: title deny rules override application allow rules.
- M07: insignificant frames produce zero intervention events.
- M08: meaningful changes become structured events with no image bytes.
- M09: automatic reasoning respects single-flight and cooldown policy.
- M10: manual Observe Now remains available during an observing day.
- M11: raw invocation images are deleted on success and failure.
- M12: V0.2 passes image paths to Codex using documented `--image` flags.
- M13: Codex remains ephemeral, read-only, approval-denied, and web-disabled.
- M14: all model responses pass V0.1 schema and assistance enforcement.
- M15: pet renderer has context isolation, sandboxing, and no Node integration.
- M16: renderer IPC is fixed and input-validated.
- M17: external action authority remains zero.
- M18: End Day produces a debrief and an ended state.
- M19: state and audits contain no raw frame or authentication data.
- M20: V0 and V0.1 release gates remain passing.
- M21: typecheck, tests, build, and package audit pass.
- M22: Windows/unsupported-platform behavior fails clearly and safely.

## Live Windows gate

- L01: pet opens always-on-top in idle state.
- L02: Start Day makes observation visibly active.
- L03: authorized Observe Now returns and displays a valid intervention.
- L04: Pause and Private prevent capture.
- L05: target repository remains unchanged.
- L06: no raw screenshot remains after the intervention.
- L07: End Day displays a debrief and stops observation.
