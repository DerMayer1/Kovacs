# Contributing to Kovacs

Kovacs is a Windows-first, local-first engineering tutor. Contributions should
make the system easier to understand, verify, operate, or evaluate without
expanding its authority.

## Before proposing a change

Open an issue or discussion before investing in:

- a new product mode or external integration;
- a new durable data category;
- a new model provider or reasoning path;
- autonomous mouse, keyboard, publishing, or repository actions;
- cloud storage or remote telemetry;
- a breaking schema, migration, or IPC change.

Small fixes, tests, documentation improvements, and reliability work can go
directly to a pull request.

## Local setup

Requirements:

- Windows 10 or 11;
- Node.js 22.12.0;
- npm;
- Codex CLI only for explicitly live acceptance checks.

Install exactly the locked dependency graph:

```powershell
npm ci
```

Run the canonical no-model quality gate:

```powershell
npm run ci
```

The ordinary development loop can use the narrower commands:

```powershell
npm run typecheck
npm test
npm run build
```

## Change design

Preserve the boundaries in
[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md):

- keep domain policy deterministic and independent of Codex;
- treat observed screen, browser, OCR, and meeting content as untrusted data;
- keep raw perception artifacts ephemeral by default;
- keep the runtime advisory-only;
- add capability-named modules, not version-named production folders;
- introduce an interface only for a real substitution or test boundary.

Do not add real screenshots, transcripts, credentials, private paths, production
databases, or copied learner memory as fixtures. Use synthetic data.

## Pull requests

Keep changes focused and explain:

1. the user or operational problem;
2. the chosen boundary and important tradeoffs;
3. how the change was verified;
4. any data, privacy, migration, or rollback impact.

Update tests and current documentation when behavior changes. Update
`CHANGELOG.md` for user-visible or operationally significant changes.

Every pull request must pass the Windows quality gate. Live acceptance is
separate because it consumes model usage and requires an authenticated Codex
installation.

## Commits

Use short, imperative Conventional Commit-style subjects when practical:

```text
fix: recover interrupted observation state
test: cover locked database startup
docs: clarify local data retention
```

Do not mix unrelated cleanup, product behavior, and documentation into one
commit.
