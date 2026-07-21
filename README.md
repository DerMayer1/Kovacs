# Kovacs

Current release: **V0.3.2 Context Foundation** — natural-language calibration, daily planning, and End Day; local Windows OCR/accessibility context; deterministic local vector memory; Codex CLI only.

Validate with `npm run v032:validate`. Run real schema acceptance with `npm run v032:live -- "C:\\path\\to\\project"` (consumes model usage).

Kovacs V0.3.1 is a visible, local-first Daily Staff Engineer Operating System for Windows. It connects a confirmed 90-day mission to a rolling weekly outcome, a daily objective, and evidence-bearing checkpoints. The always-on-top pet retains the V0.2 privacy-aware observer while competence and memory remain structured, local, and inspectable.

The main goal is fixed and visible:

> Become an Elite AI Systems Staff Engineer, using OpenAI as the benchmark of engineering efficiency, judgment, and impact.

## V0.3.1 behavior

- First run asks for your current position, available time, active projects, growth edges, and desired 90-day outcome.
- Codex CLI drafts the 90-day mission and first rolling week; neither becomes durable until you confirm it.
- Each day, Kovacs may challenge a vague or low-value objective and proposes measurable checkpoints.
- Observation begins only after you approve the daily plan.
- Checkpoint evidence distinguishes self-reported, observed, tool-verified, artifact-verified, and reviewed claims.
- Checkpoints can be blocked, deferred, abandoned, or deliberately reactivated with an audit reason.
- Competencies begin `unverified` and advance only through sourced practice outcomes.
- End Day is explicitly triggered and requires output, validation, lesson, and outcome classification.
- Memory and honest invocation telemetry are stored in local SQLite and exposed in the pet. Characters are never presented as provider tokens or billing cost.
- Raw screenshots and window titles remain ephemeral. Captured pixels, transcripts, audio, and authentication data are not stored.
- Restarts recover unfinished days and drafts without resuming observation. Interrupted Codex calls are marked explicitly.
- Retention controls, per-day/session deletion, JSON export, and consistent SQLite backup are local and user-triggered.
- Kovacs advises and drafts only. It cannot click, type, send, submit, publish, commit, or perform post-session actions.

Meeting Mode, Google Meet captions, Career Mode, and autonomous computer actions are reserved for later versions. Direct OpenAI API integration is intentionally not planned; Codex CLI remains the model gateway.

## Install and verify

Requirements:

- Windows 10 or 11
- Node.js 22.12 or newer
- authenticated local Codex CLI

```powershell
cd C:\Users\lucas\Kovacs
npm install
npm run v03:validate
npm run v031:validate
```

The release gate runs V0, V0.1, V0.2, and V0.3 regressions, migrations, lifecycle recovery, privacy, backup, Electron security, build verification, and dependency audit.

## Launch

```powershell
npm run pet
```

First run:

1. Complete Initial Calibration.
2. Review and confirm the proposed 90-day mission and first week.
3. Enter the primary project and today's objective.
4. Review and approve the daily plan.
5. Work in authorized applications and record evidence at each checkpoint.
6. Explicitly select End Day and provide output, validation, and lesson.

`Ctrl + Alt + K` toggles observation. Pause and Private perform no capture.

## Local data

V0.3 data is stored outside target repositories:

```text
%LOCALAPPDATA%\Kovacs\v0.3\kovacs.db
%LOCALAPPDATA%\Kovacs\v0.3\ambient\
%LOCALAPPDATA%\Kovacs\v0.3\v01-sessions\
```

The SQLite database contains confirmed goals, plans, checkpoints, evidence, competency state, editable memories, feedback, lifecycle audit, and model-call telemetry. It does not contain screenshot bytes or window titles.

V0.2 authorization settings are created under the V0.3 ambient directory. Denied title patterns still override the application allowlist.

## Commands

```powershell
npm run typecheck
npm test
npm run build
npm run v03:smoke
npm run v03:validate
npm run v031:smoke
npm run v031:validate
npm run pet
```

The real Codex acceptance is separate because it performs two model calls:

```powershell
npm run v031:live -- "C:\path\to\an\authorized\project"
```

The previous pet remains launchable with:

```powershell
npm run pet:v02
```

The V0.1 terminal tutor remains available:

```powershell
npm run dev -- start "C:\path\to\project" "Diagnose the failing integration test" training
npm run dev -- coach ses_... "Help me choose the next diagnostic step" A2
```

## Architecture

- charter: `docs/v0.3/00_CHARTER.md`
- architecture: `docs/v0.3/01_ARCHITECTURE.md`
- state machine: `docs/v0.3/02_STATE_MACHINE.md`
- memory and competence: `docs/v0.3/03_MEMORY_AND_COMPETENCE.md`
- token economy: `docs/v0.3/04_TOKEN_ECONOMY.md`
- success metrics: `docs/v0.3/05_SUCCESS_METRICS.md`
- V0.3.1 hardening charter: `docs/v0.3.1/00_HARDENING_CHARTER.md`
- migration and recovery: `docs/v0.3.1/01_MIGRATION_AND_RECOVERY.md`
- 5-10 day pilot protocol: `docs/v0.3.1/02_PILOT_PROTOCOL.md`
- V0.3.2 Context Foundation charter: `docs/v0.3.2/00_CONTEXT_FOUNDATION_CHARTER.md`
- contracts: `contracts/v0.3/`
- runtime: `src/v03/`
- pet renderer: `ui/v0.3/`
- validation and smoke: `v03/`

Codex CLI runs ephemerally with ignored user configuration, denied approval, disabled web search, a read-only sandbox, and schema-constrained output. Local deterministic logic owns routine state so model calls remain attributable and economically justified.
