# Kovacs Architecture

Status: normative

This document describes the current runtime architecture. Versioned folders under
`docs/`, `contracts/`, and `scripts/releases/` preserve release history and
compatibility; they do not define production module boundaries.

## Architectural style

Kovacs is a local-first modular monolith with four explicit layers:

```text
interfaces
    |
    v
application
    |
    v
core

infrastructure implements runtime capabilities used by application and interfaces
```

The dependency direction is intentional:

- `core` contains stable domain language, deterministic policy, and no Electron,
  SQLite, Codex process, or filesystem orchestration.
- `application` coordinates use cases and depends on core policy plus narrow local
  infrastructure services.
- `infrastructure` owns external mechanisms: Codex CLI, SQLite, JSON Schema,
  Windows perception, Electron capture adapters, and environment configuration.
- `interfaces` composes the application for a human-facing entrypoint. It contains
  no business policy.

No production module imports from `scripts/releases`, `test`, `docs`, or `ui`.

Kovacs currently has one persistence implementation and one reasoning gateway.
Those concrete adapters are injected into application controllers rather than
hidden behind speculative one-method interfaces. Introduce a port when a second
implementation or a materially different test boundary exists; do not add
abstractions solely to imitate a framework diagram.

## Source map

```text
src/
  core/
    coaching/            Profiles, modes, assistance, request/response types
    context/             Compact context classification and summaries
    memory/              Deterministic local retrieval primitives
    observation/         Authorization and intervention policy
    operating-system/    Missions, plans, evidence, memory, and competency types
    security/            Redaction and local sensitive-content decisions

  application/
    coaching/            Manual coaching service and bounded project context
    observation/         Event-driven observer and perception cascade
    operating-system/    Confirmed mission/week/day/checkpoint lifecycle
    planning/            Schema-constrained Codex planning adapter

  infrastructure/
    codex/               Ephemeral, read-only Codex CLI gateway
    config/              Environment and local-data configuration
    contracts/           JSON Schema loading and validation
    persistence/         Session, observation, and SQLite operating stores
    windows/             UI Automation, OCR, and Electron capture adapters

  interfaces/
    cli/                 Terminal tutor commands
    desktop/             Electron composition roots
```

## Runtime composition

The desktop composition root constructs the system in this order:

```text
configuration
  -> contract validators
  -> local stores
  -> Codex coaching service
  -> Windows perception adapters
  -> observation controller
  -> operating-system controller
  -> narrow Electron IPC interface
```

Routine observation never implies model reasoning:

```text
authorized event
  -> UI Automation
  -> local sensitive-content guard
  -> OCR only when required
  -> compact context frame
  -> deterministic decision
      -> silence
      -> or one attributable Codex request
```

## Compatibility boundaries

These identifiers remain versioned deliberately:

- JSON Schema directories and `schema_version` values;
- SQLite migration records and existing local-data paths;
- Electron IPC channel names consumed by the current renderer;
- historical release charters and release gates.

Changing one of these is a migration, not a folder cleanup.

## Dependency rules

1. Core policy must remain deterministic and testable without Codex.
2. Screen, OCR, browser, and meeting content enters as untrusted observation data.
3. Raw perception artifacts remain invocation-scoped and ephemeral by default.
4. Application controllers may request advice but may not grant external action
   authority.
5. SQLite and local files remain the default durable substrate.
6. Every intervention is attributable to an event and records an outcome when one
   becomes known.
7. New capabilities extend an existing module or add a capability-named module;
   they do not create a new version-named production directory.

## Tests and releases

Tests mirror product capabilities:

```text
test/
  coaching/
  context/
  observation/
  operating-system/
  security/
```

Release-specific orchestration lives under `scripts/releases/<version>/`. The
canonical developer commands point to the current release:

```text
npm run typecheck
npm test
npm run build
npm run release:validate
```

Historical aliases remain available for regression isolation.
