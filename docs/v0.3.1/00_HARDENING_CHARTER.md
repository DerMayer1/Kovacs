# Kovacs V0.3.1 Hardening Charter

Status: normative

## Objective

Make the V0.3 Daily Staff Engineer Operating System safe and reliable enough for a real 5-10 day pilot. V0.3.1 strengthens continuity, epistemic honesty, user control, privacy, and observability without attempting the V0.4 Context Engine.

Kovacs remains the contextual direction layer. Codex remains the deep technical execution layer. Neither screen activity nor user-entered validation text is automatically treated as proof.

## Product contract

- Existing V0.3 data upgrades in place through additive, versioned migrations.
- An unfinished day and pending proposal survive restart, but observation never resumes automatically.
- An invocation left in flight by a crash becomes `interrupted`, never success.
- Evidence provenance is one of `self_reported`, `observed`, `tool_verified`, `artifact_verified`, or `reviewed`.
- A user may reject or revise a proposal and revise an active objective with a durable reason.
- Checkpoints may be active, completed, blocked, deferred, or abandoned. End Day carries unfinished work explicitly.
- End Day stores deterministic facts before they are used as narrative context.
- Authorized window titles and screenshots may be sent transiently to Codex for a justified reasoning call, but are not durable Kovacs state. Transcripts, audio, credentials, and full browser contents are not retained.
- Retention, scoped deletion, feedback, backup, and export are explicit user operations.
- Prompt and response characters are context-size proxies, never provider token or billing claims.
- Kovacs advises and drafts only. It cannot click, type, send, submit, publish, commit, or assume external authority.

## Included

- SQLite schema version `0.3.1` and integrity check;
- interrupted-invocation recovery;
- evidence provenance migration and selection;
- audited draft, objective, and checkpoint changes;
- deterministic partial-day summary and carry-forward;
- expanded invocation health telemetry;
- local intervention feedback;
- retention policy and per-day/session memory deletion;
- consistent SQLite backup plus human-readable JSON export;
- recovery, privacy, and first-use explanations in the pet;
- automated hardening gate, deterministic smoke, optional real Codex acceptance, and pilot protocol.

## Excluded

- OCR, semantic screen understanding, captions, audio, Google Meet, Client Mode, Career Mode, or social-media workflows;
- vector memory, cloud synchronization, direct OpenAI API integration, or autonomous policy adaptation;
- autonomous computer use or any action after a session;
- encryption-at-rest. V0.3.1 minimizes and controls durable data; encrypted storage requires a separately designed Windows key-management boundary.

## Release rule

The automated V0.3.1 gate must pass fully. The real Codex acceptance is intentionally separate because it consumes model usage. The release may enter pilot after one live acceptance succeeds; product-quality claims require the full 5-10 day pilot.
