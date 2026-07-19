# V0 Architecture Decisions

Status: accepted for V0

## ADR-001: Tutor-first objective hierarchy

Decision: long-term independent capability outranks immediate performance except during explicitly bounded Ship or Incident Mode.

Reason: otherwise Kovacs becomes an answer-feeding assistant that may weaken the ability it is meant to develop.

## ADR-002: One identity, specialized reasoning profiles

Decision: use one Kovacs identity with controlled profiles, not an autonomous multi-agent swarm.

Reason: reduces latency, cost, conflicting authority, and evaluation complexity.

## ADR-003: Event-driven, never continuous LLM polling

Decision: local systems may observe in future phases, but Codex is called only after a meaningful policy-approved event.

Reason: protects focus, privacy, cost, and behavioral stability.

## ADR-004: Codex Option A for the first runtime

Decision: use `codex exec` behind a neutral gateway for the first live reasoning phase.

Reason: it is isolated, auditable, terminable, schema-constrained, and easy to replay. Migration to SDK or MCP occurs only when measured limitations justify it.

## ADR-005: External memory is authoritative

Decision: Codex threads are working context, not canonical memory.

Reason: memory requires provenance, correction, retention, privacy, and inspectability that conversation history alone does not provide.

## ADR-006: Deterministic policy controls model access

Decision: privacy, consent, interruption, and action authority are enforced outside the model.

Reason: model compliance is not a sufficient control boundary.

## ADR-007: Screen is a fallback coding sensor

Decision: future editor, terminal, Git, and test adapters provide structured engineering evidence; screen context explains attention and visual-only state.

Reason: direct artifacts are more accurate, cheaper, and easier to verify than OCR or screenshots.

## ADR-008: Fail closed

Decision: invalid schema, uncertain consent, restricted sensitivity, invalid response, and policy mismatch prevent downstream processing.

## ADR-009: V0 contains no sensors or action plane

Decision: V0 ends at architecture, contracts, policy, and simulations.

Reason: intelligence governance must be proven before observation or control expands the risk surface.
