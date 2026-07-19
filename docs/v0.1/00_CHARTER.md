# Kovacs V0.1 Charter

Status: normative

## Objective

Prove that a manually invoked Kovacs can inspect a real engineering situation and return safer, more pedagogical, more context-aware guidance than a generic coding-agent request without passive monitoring or autonomous modification.

## Included

- terminal-only CLI;
- explicit user invocation;
- Coach, Inspect, Assess, and Debrief profiles;
- Training, Pair, and Assessment modes;
- external temporary session state;
- privacy and sensitivity gate;
- context selection and hard budget;
- ephemeral, read-only `codex exec` gateway;
- JSONL trace capture and schema-constrained final output;
- assistance-ceiling enforcement;
- controlled timeout and non-zero-exit behavior;
- auditable session events;
- deterministic fixtures and one live smoke path.

## Excluded

- passive monitoring or background polling;
- screen, audio, meeting, browser, editor, Git, or social adapters;
- overlay or notifications;
- persistent Codex sessions;
- permanent learner-memory promotion;
- file modification by Codex;
- automatic commands with side effects;
- publishing, messaging, committing, clicking, or typing;
- Ship or Incident modes.

## Profiles

- `coach`: smallest useful question, gap identification, or hint.
- `inspect`: evidence-backed observations from the authorized repository.
- `assess`: independent evaluation with A0-A1 assistance and no solution leakage.
- `debrief`: outcome, assistance used, demonstrated understanding, unknowns, and next checkpoint.

## Modes

- `training`: assistance ceiling A3.
- `pair`: assistance ceiling A5.
- `assessment`: assistance ceiling A1 and complete solutions forbidden.

## Release rule

V0.1 passes only when every metric in `02_SUCCESS_METRICS.md` passes and the live `codex exec` smoke test returns a valid, policy-compliant response without repository changes.
