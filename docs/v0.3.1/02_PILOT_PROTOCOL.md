# V0.3.1 Pilot Protocol

## Purpose

Use Kovacs during 5-10 real workdays to determine whether its planning and ambient interventions improve direction without creating distraction, privacy risk, or excessive Codex usage. The protocol evaluates V0.3.1; it does not test future OCR, Meeting, Client, or Career modes.

## Before day one

- Run `npm run v031:validate`.
- Run `npm run v031:live -- C:\path\to\an\authorized\project` and retain only its aggregate output.
- Inspect allowed applications and denied title patterns.
- Keep window-title retention disabled; V0.3.1 does not expose an override.
- Create one backup and inspect the JSON export.

## Daily procedure

1. Draft and confirm one measurable daily objective.
2. Record the time from request to proposal and whether the proposal needed local revision or rejection.
3. Work only in explicitly authorized applications.
4. Label each displayed intervention: useful, not useful, wrong context, unnecessary interruption, or already known.
5. Classify checkpoint evidence honestly. Select tool or artifact verification only when a concrete verifier or artifact exists.
6. End the day explicitly even when the outcome is partial, blocked, or misdirected.
7. Review carry-forward, memories, failures, and the first movement for tomorrow.

## Measures

Record per day:

- proposal latency and total model-call latency;
- invocation count, failed/interrupted/discarded calls, prompt characters, and response characters;
- interventions displayed and percentage marked useful;
- wrong-context and unnecessary-interruption counts;
- planned, completed, blocked, deferred, and abandoned checkpoints;
- self-reported versus tool-, artifact-, or review-verified evidence;
- proposals revised or rejected;
- restart/recovery incidents;
- memories corrected or deleted;
- any private information found in SQLite, ambient JSON, backup, or export.

## Stop conditions

Pause the pilot and open a defect if:

- raw screenshots, window titles, credentials, transcripts, or audio become durable;
- observation resumes without user action;
- a second active day is created;
- state is lost or corrupted after restart;
- Kovacs presents self-reported evidence as tool- or artifact-verified;
- an external action is attempted;
- three consecutive interventions use the wrong project, objective, client, or checkpoint context.

## Exit criteria

The pilot is sufficient to specify V0.4 when:

- at least five complete days exist;
- restart has been exercised at least twice;
- at least twenty interventions have feedback or the system correctly remained mostly silent;
- all durable data has been inspected once;
- failure and false-positive patterns are grouped into a written taxonomy;
- the V0.4 Context Engine requirements are derived from observed gaps rather than imagined modes.
