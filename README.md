# Kovacs

Kovacs is a local-first, event-driven Staff Engineer development system powered by Codex.

## Current release: V0 passed

V0 is an architecture-and-simulation release. It contains no monitoring or autonomous action. Its purpose is to prove the mission, boundaries, event vocabulary, memory ontology, intervention policy, privacy model, Codex execution contract, and representative behavior before runtime expansion.

Validate the V0 release gate:

```text
npm install
npm run v0:validate
```

The V0 specification is under `docs/v0/`, machine contracts are under `contracts/v0/`, and replayable simulations are under `v0/`.

The earlier SDK/SQLite implementation under `src/` is a technical spike. It is excluded from V0 acceptance. The selected first live architecture will use `codex exec` behind a neutral gateway.

## Technical spike

The spike demonstrated the following intelligence loop:

```text
observation -> intervention policy -> relevant memory -> Codex -> recorded outcome
```

The first version provides:

- persistent SQLite learner memory;
- sourced and confidence-scored memory records;
- structured engineering observations;
- an event policy that prevents continuous LLM polling;
- persistent Codex SDK threads;
- optional screenshot input;
- read-only, advisory Codex operation;
- a CLI suitable for future Windows sensors and an overlay.

## Requirements

- Windows, macOS, or Linux
- Node.js 22+
- An authenticated local Codex installation

## Start

```text
npm install
npm run dev -- init
npm run dev -- status
```

Initialize target information:

```text
npm run dev -- remember goal target_company "OpenAI"
npm run dev -- remember goal technical_wedge "AI systems engineering"
```

Ask Kovacs directly:

```text
npm run dev -- coach "Begin my evidence-based diagnostic interview" --mode assessment
```

Record an event and allow the policy to decide whether Kovacs should intervene:

```text
npm run dev -- observe repeated_error "The same integration test failed three times"
```

Attach a screenshot:

```text
npm run dev -- observe manual "Inspect what I am doing" --image C:\path\screen.png
```

Record an event without calling Codex:

```text
npm run dev -- observe commit "Implemented the first memory schema" --no-coach
```

## Current safety model

- Codex runs read-only with approvals disabled for the observation loop.
- Restricted observations are never sent to Codex.
- The runtime performs no automatic typing, clicking, publishing, committing, or file editing.
- Images are referenced only when explicitly attached; automatic capture is not implemented yet.
- Screen-derived text must be treated as untrusted data.

## Next vertical

The next implementation milestone is a Windows tray observer with:

1. an explicit global capture hotkey;
2. active-window allowlisting;
3. local screenshot redaction and short retention;
4. event submission to this runtime;
5. a small always-on-top Kovacs response overlay.

Continuous capture, meeting audio, and social-media context should be added only after the manual observation loop proves useful.
