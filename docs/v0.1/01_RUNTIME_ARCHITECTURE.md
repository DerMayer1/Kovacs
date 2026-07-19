# V0.1 Runtime Architecture

```text
CLI command
  -> argument validation
  -> session load/create
  -> manual V0 event
  -> privacy and secret gate
  -> context collector and budget
  -> assistance policy
  -> prompt assembler
  -> codex exec gateway
  -> response schema validation
  -> assistance compliance validation
  -> terminal renderer
  -> append-only session audit
```

## Runtime authority

The orchestrator owns process lifecycle, timeout, context selection, privacy, response validation, session state, and display. Codex owns bounded engineering reasoning only.

## Codex invocation

The gateway launches the resolved native Codex executable with:

```text
exec
--ephemeral
--ignore-user-config
--json
--sandbox read-only
--cd <authorized project>
--output-schema <v0.1 response schema>
--output-last-message <temporary file>
--color never
-c approval_policy="never"
-c web_search="disabled"
-
```

The prompt is written through stdin. The gateway captures JSONL stdout, stderr, exit code, duration, and final response separately. Temporary output is removed after validation.

On Windows desktop installations, Kovacs prefers the npm Codex package's native binary because Microsoft Store ACLs can reject direct child-process execution. Every invocation receives an isolated temporary `CODEX_HOME` containing only a short-lived copy of the existing authentication record. Shared caches, plugins, sessions, skills, and user configuration are excluded, and the temporary home is deleted after the invocation.

## Session state

Session files live outside the target repository under the configured Kovacs data directory. They contain task, mode, user hypotheses, manual attempts, requests, validated interventions, failures, checkpoints, and final debrief. They are not the permanent learner model planned for V0.2.

## Failure behavior

- restricted request: block before context collection;
- context outside project: reject;
- secret-like content: redact before prompt assembly;
- oversized context: truncate deterministically and record it;
- timeout: terminate the process tree and record failure;
- non-zero exit: display no model response;
- malformed JSON or schema mismatch: reject;
- assistance above ceiling: reject;
- assessment solution leakage: reject;
- target repository changed during invocation: fail the smoke test.
