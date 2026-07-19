# Kovacs

Kovacs V0.1 is an explicit, read-only Staff Engineer tutor powered by the local Codex CLI. It helps a learner make better engineering decisions without monitoring the screen, taking autonomous actions, or silently replacing the learner's work.

## What V0.1 does

- runs only after an explicit terminal command;
- supports Coach, Inspect, Assess, and Debrief profiles;
- supports Training, Pair, and Assessment modes;
- applies A0-A5 assistance ceilings and blocks Assessment answer leakage;
- selects only user-supplied terminal text, notes, and project-contained files;
- blocks restricted context and redacts common secret formats locally;
- launches `codex exec` ephemerally with ignored user configuration, disabled web search, denied approval, and a read-only sandbox;
- validates every model response before display;
- stores temporary, auditable sessions outside the target repository;
- never permits an external action request.

V0.1 does not monitor the screen, listen to meetings, observe social media, run continuously, edit code, or maintain a permanent learner model.

## Requirements

- Node.js 22 or newer
- an authenticated local Codex CLI installation

Install and verify:

```text
npm install
npm run v01:validate
```

The automated release gate covers 18 metrics and 20 benchmark scenarios. A real Codex acceptance check is available separately because it consumes model calls:

```text
npm run v01:smoke -- C:\path\to\target-project
```

## Use Kovacs

Start a deliberate-practice session:

```text
npm run dev -- start "C:\path\to\your-real-project" "Diagnose the failing integration test" training
```

The path above is a placeholder: replace it with an existing repository such as `C:\Users\lucas\Kovacs`. The positional form is recommended through `npm run` because some PowerShell/npm combinations consume named options.

The command returns a session ID. Use it for explicit interventions:

```text
npm run dev -- coach ses_... "Help me choose the next diagnostic step" A2
```

For advanced context options, invoke the CLI directly so PowerShell passes every named option unchanged:

```text
npx tsx src/cli.ts coach --session ses_... --request "Help me choose the next diagnostic step" --hypothesis "The cache is stale" --attempt "Reproduced with one account" --assistance A2
```

Inspect selected evidence without edits:

```text
npx tsx src/cli.ts inspect --session ses_... --request "Inspect the error boundary" --file src\api.ts --terminal-file .\last-test-output.txt --assistance A3
```

Test your reasoning without receiving the answer:

```text
npm run dev -- assess ses_... "Assess whether my concurrency model is correct" A1
```

Close the session:

```text
npm run dev -- debrief ses_... "Debrief my reasoning and prescribe the next practice action" A2
```

Inspect the audit record:

```text
npm run dev -- status --session ses_... --json
```

Repeat `--attempt` and `--file` to provide multiple values. Sensitivity defaults to `internal`; `restricted` requests are always blocked before Codex is called. Add `--json` to any command for machine-readable output.

## Configuration

- `KOVACS_DATA_DIR`: session storage; defaults to `%LOCALAPPDATA%\Kovacs\v0.1` on Windows.
- `KOVACS_CODEX_BIN`: explicit native Codex executable path.
- `KOVACS_CODEX_TIMEOUT_MS`: process timeout; defaults to 120000.
- `KOVACS_CONTEXT_CHARACTER_BUDGET`: total explicit context budget; defaults to 40000.
- `KOVACS_SELECTED_FILE_CHARACTER_LIMIT`: per-file limit; defaults to 16000.

On Windows, Kovacs prefers the npm Codex package's native binary when the Microsoft Store executable rejects direct child-process execution. Model execution uses a temporary isolated Codex home containing only the existing authentication record, then deletes it.

## Architecture and evidence

- V0.1 charter: `docs/v0.1/00_CHARTER.md`
- runtime boundary: `docs/v0.1/01_RUNTIME_ARCHITECTURE.md`
- success metrics: `docs/v0.1/02_SUCCESS_METRICS.md`
- machine contracts: `contracts/v0.1/`
- blind-comparison benchmark: `benchmarks/v0.1/`
- runtime: `src/v01/`
- release validator and live smoke: `v01/`

V0 remains preserved under `docs/v0/`, `contracts/v0/`, and `v0/`. V0.2 can add a consent-based durable learner model after V0.1 produces enough real sessions to justify what should be remembered.
