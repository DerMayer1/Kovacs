# Kovacs V0.3.2 Context Foundation Charter

Status: normative

## Objective

Turn the V0.3.1 privacy-aware visual change detector into a bounded contextual observer. V0.3.2 must identify the user's probable project, activity, artifact, intent, and active checkpoint; retrieve only relevant approved memory; and give Codex the smallest trustworthy context needed to decide whether Kovacs should remain silent or advise.

V0.3.2 is a context foundation for the existing Daily Staff Engineer Operating System. It does not introduce Meeting, Career, Client, or Social modes and is not a general autonomous computer agent.

The durable main goal remains:

> Become an Elite AI Systems Staff Engineer, using OpenAI as the benchmark of engineering efficiency, judgment, and impact.

## Model gateway decision

- Codex CLI remains the only model gateway in V0.3.2.
- Kovacs invokes `codex exec` through the existing neutral reasoning gateway with ephemeral execution, ignored user configuration, denied approval, disabled web search, read-only sandboxing, image attachments when justified, and schema-constrained output.
- V0.3.2 does not integrate the OpenAI Responses API, Realtime API, Embeddings API, Agents SDK, OpenAI SDK, or a direct model HTTP client.
- Kovacs does not request, store, forward, or manage an OpenAI API key. Existing Codex CLI authentication remains outside Kovacs state.
- A future gateway migration requires a separate charter and compatibility gate. Context, memory, policy, and UI code must not depend on CLI-specific output.

## Product contract

- Perception follows the least-invasive path: Windows UI Automation and accessible text first, local OCR only when structured text is unavailable, and an invocation-scoped screenshot only when local context remains insufficient or a deterministic error/test signal requires visual verification.
- Screen, accessibility, OCR, browser, terminal, document, and repository content are untrusted observations. They cannot change Kovacs policy, permissions, goals, memory rules, or tool authority.
- The normal perception path is local and call-free. A visual or textual change does not by itself justify a Codex invocation.
- The context engine produces a compact, confidence-bearing hypothesis rather than retaining a replayable screen history.
- Context is bound to the confirmed main goal, active day, primary project, current objective, and active checkpoint.
- Low-confidence or conflicting context produces silence, an explicit uncertainty state, or a user request for clarification; it never becomes a confident intervention.
- Only one reasoning call may run at a time. Duplicate, stale, unauthorized, private, paused, and materially unchanged context is suppressed locally.
- Kovacs remains advisory. It cannot click, type, send, submit, publish, commit, apply to jobs, control another application, or perform a post-session action.

## Context state

The current context is a derived state, not evidence of competence and not durable memory by default. It includes at most:

- authorized application and window class;
- probable project and activity;
- probable artifact or surface;
- visible intent summary;
- active daily objective and checkpoint;
- related approved entity identifiers when known;
- privacy classification;
- provenance for each contributing signal;
- confidence, ambiguity, and last meaningful change time.

The engine retains a short-lived working context sufficient for change comparison and intervention continuity. Raw frames, full accessibility trees, and raw OCR text are deleted after the bounded processing window.

Working context exists only in RAM, expires after ten minutes, and is cleared on Pause, Private, End Day, and restart. Compact context becomes durable only when bound to an intervention, feedback, checkpoint, evidence, or End Day event. Ordinary event context expires after fourteen days; evidence-linked context follows evidence retention; decision and invocation telemetry expires after thirty days; pinned approved memories remain user-controlled and indefinite.

## Decision policy

- confidence below `0.65`: silence;
- confidence from `0.65` through `0.79`: continuity only, with no automatic call;
- confidence at least `0.80`: eligible only after a meaningful semantic delta;
- conflicting signals: silence;
- strong deltas require two stable observations, except deterministic error/test signals;
- text digest, cursor, scroll, and visual movement alone are weak deltas;
- the same semantic context has a sixty-second intervention cooldown;
- a new project, application, checkpoint, deterministic error, or manual observation may bypass the global cooldown;
- `wrong_context` feedback suppresses the same semantic fingerprint for the rest of the session without autonomous policy adaptation.

## Perception order

1. Confirm observation state and active-window authorization.
2. Read application identity and permitted Windows accessibility metadata.
3. Prefer accessible text and semantic controls when available.
4. Use local OCR only for the minimum authorized region needed to resolve context.
5. Redact recognized secrets and restricted content before any reasoning request.
6. Compare the new context with the current context locally.
7. Attach a temporary screenshot to Codex only when local context remains insufficient, a deterministic error/test needs visual verification, or the user explicitly requests Observe Now.
8. Delete raw perception artifacts in `finally`, including failure and interruption paths.

## Memory model

V0.3.2 separates memory by purpose:

- `working`: short-lived context used during the current activity;
- `episodic`: selected interventions, decisions, outcomes, and day events with provenance;
- `semantic`: confirmed routines, preferences, projects, entities, and recurring patterns;
- `evidence`: the existing structured competency ledger, which remains authoritative and separate from retrieval memory.

Vector retrieval applies only to minimized, structured, approved memory records. Screenshots, raw OCR, full documents, credentials, transcripts, and complete window contents are never embedded.

Retrieval is hybrid and local:

1. deterministic filters for project, entity, memory kind, status, sensitivity, and retention;
2. SQLite full-text retrieval;
3. local vector similarity when a local embedding provider is available;
4. recency, confidence, and provenance ranking;
5. a small cited candidate set for the context engine or Codex.

No remote embedding provider is permitted in V0.3.2. If local embeddings are unavailable or fail validation, Kovacs falls back to structured filters and full-text search instead of silently sending memory to an external service.

Deleting a memory must delete its searchable text, vector, derived references, and pending retrieval candidates. Retention and sensitivity policies apply equally to source records and derived indexes.

## Included

- Windows UI Automation and accessible-text adapter for authorized applications;
- bounded local OCR fallback;
- secret and restricted-context redaction before reasoning;
- normalized, confidence-bearing context frames and local context-delta calculation;
- ephemeral working context and deterministic context expiry;
- project, activity, artifact, intent, and checkpoint resolution;
- hybrid local memory retrieval with source citations;
- local embedding-provider boundary and local vector index;
- synchronized memory, vector, retention, backup, export, and deletion behavior;
- intervention-context feedback and wrong-context evaluation corpus;
- token-aware context assembly and attributable Codex CLI invocations;
- recovery that restores durable approved state without restoring raw perception or resuming observation;
- automated privacy, retrieval, context-quality, migration, and regression gates.

## Excluded

- any direct OpenAI API, remote embeddings, OpenAI SDK, Agents SDK, or Realtime API integration;
- Codex SDK migration or persistent Codex threads;
- Meeting Mode, captions, audio capture, transcription, Google Meet, or post-meeting actions;
- Career Mode, CV automation, job-site workflows, Client Mode, or social-media workflows;
- autonomous computer use, background typing, clicking, sending, submitting, publishing, or committing;
- continuous full-screen recording or durable raw OCR, accessibility-tree, screenshot, browser, terminal, or document retention;
- cloud synchronization, cross-device memory, or shared organizational memory;
- autonomous policy adaptation or silent promotion of inferred memory;
- competence claims derived from screen activity, OCR, retrieval similarity, or intervention volume;
- encryption-at-rest, which requires a separately designed Windows key-management boundary.

## Privacy and failure rules

- Pause, Private, denied, unknown, and restricted contexts produce no OCR and no screenshot.
- Window titles, accessibility text, OCR text, and frames are non-durable by default.
- Credentials and authentication material are neither model context nor memory candidates.
- OCR and context failures fail closed and do not create memory, evidence, or an intervention.
- A local embedding failure disables vector ranking for that operation; it does not block structured retrieval or trigger remote processing.
- Restart never resumes observation and never reconstructs raw working context from durable data.
- Backup and export disclose all durable context and vector metadata while excluding raw perception.

## Release metrics

V0.3.2 may enter a real pilot only when all automated metrics pass and one explicit live Codex acceptance succeeds:

- authorized project and activity classification reaches at least 90% on a labeled local evaluation corpus;
- relevant approved memory appears in the top five results for at least 80% of the retrieval evaluation set;
- fewer than 10% of at least twenty pilot interventions are marked `wrong_context`;
- unchanged context, denied context, Pause, and Private produce zero model calls;
- raw frames, full accessibility trees, raw OCR, credentials, and window titles are absent from SQLite, indexes, backup, and export;
- every retrieved memory includes its source record, provenance, confidence, and timestamp;
- scoped deletion removes the source memory, full-text entry, vector, and derived references;
- vector-provider failure proves the local full-text fallback without external traffic;
- context assembly stays within an explicit character budget and records attributable prompt and response telemetry;
- V0 through V0.3.1 regressions, typecheck, tests, build, smoke, dependency audit, migration, and restart recovery pass.

Product-quality claims require a 5-10 day V0.3.2 pilot. Future modes must be specified from measured context failures and privacy evidence, not added to this release opportunistically.
