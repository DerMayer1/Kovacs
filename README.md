# Kovacs

Kovacs V0.3 is a visible, local-first Daily Staff Engineer Operating System for Windows. It connects a confirmed 90-day mission to a rolling weekly outcome, a daily objective, and evidence-bearing checkpoints. The always-on-top pet retains the V0.2 privacy-aware observer while competence and memory remain structured, local, and inspectable.

The main goal is fixed and visible:

> Become an Elite AI Systems Staff Engineer, using OpenAI as the benchmark of engineering efficiency, judgment, and impact.

## V0.3.0 behavior

- First run asks for your current position, available time, active projects, growth edges, and desired 90-day outcome.
- Codex CLI drafts the 90-day mission and first rolling week; neither becomes durable until you confirm it.
- Each day, Kovacs may challenge a vague or low-value objective and proposes measurable checkpoints.
- Observation begins only after you approve the daily plan.
- Checkpoint evidence records result, validation, outcome, competency, and A0-A5 assistance used.
- Competencies begin `unverified` and advance only through sourced practice outcomes.
- End Day is explicitly triggered and requires output, validation, lesson, and outcome classification.
- Memory and usage telemetry are stored in local SQLite and exposed in the pet.
- Raw screenshots remain ephemeral. Captured pixels, transcripts, audio, and authentication data are not stored.
- Kovacs advises and drafts only. It cannot click, type, send, submit, publish, commit, or perform post-session actions.

Meeting Mode, Google Meet captions, Career Mode, direct OpenAI API integration, and autonomous computer actions are reserved for later versions.

## Install and verify

Requirements:

- Windows 10 or 11
- Node.js 22.12 or newer
- authenticated local Codex CLI

```powershell
cd C:\Users\lucas\Kovacs
npm install
npm run v03:validate
```

The release gate runs V0, V0.1, and V0.2 regressions, contracts, lifecycle tests, SQLite restart tests, privacy checks, Electron security checks, build verification, and dependency audit.

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

The SQLite database contains confirmed goals, plans, checkpoints, evidence, competency state, editable memories, and model-call telemetry. It does not contain screenshot bytes.

V0.2 authorization settings are created under the V0.3 ambient directory. Denied title patterns still override the application allowlist.

## Commands

```powershell
npm run typecheck
npm test
npm run build
npm run v03:smoke
npm run v03:validate
npm run pet
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
- contracts: `contracts/v0.3/`
- runtime: `src/v03/`
- pet renderer: `ui/v0.3/`
- validation and smoke: `v03/`

Codex CLI runs ephemerally with ignored user configuration, denied approval, disabled web search, a read-only sandbox, and schema-constrained output. Local deterministic logic owns routine state so model calls remain attributable and economically justified.
