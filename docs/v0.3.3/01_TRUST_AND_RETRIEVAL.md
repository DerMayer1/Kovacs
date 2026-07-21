# Trust and retrieval design

## Local trust boundary

The perception cascade reads the active-window title and UI Automation text first. If more evidence is required, it captures once for local OCR. Every extracted text channel passes through the same local guard before context synthesis.

The guard reports categories, not secret values. A sensitive result blocks screenshot attachment even for an explicit Observe Now request. If OCR is unavailable, Kovacs cannot prove the image is safe and therefore withholds it. Prompt-injection-like text is retained only as a local risk flag; automatic reasoning remains silent, while a manual request may proceed with sanitized text and no blocked image.

`KOVACS_RESTRICTED_TERMS` accepts a comma-separated local list. Terms are redacted before reasoning and are never persisted as a configuration-derived screen observation.

## Calibration correction

An interpreted calibration draft has a stable identifier and monotonically increasing revision. Direct fact edits and accepted unknowns are local SQLite changes and consume zero model calls. Clarification answers are bounded to two answers and are sent only when the learner selects the refinement action. That action produces one Codex CLI invocation and another reviewable revision; confirmed fields must be preserved.

## Retrieval V2

Eligible rows are filtered before ranking:

1. status must be active;
2. global memory is eligible, plus project memory matching the active project;
3. optional memory-kind filters are applied;
4. sensitivity must not exceed the request boundary.

Ranking combines FTS/lexical relevance, deterministic local-vector similarity, confidence, and a small explicit pin bonus. The response identifies one of three paths: `fts_vector`, `fts_only`, or `lexical_fallback`. No embedding model, network request, or direct API is required.

Retrieval diagnostics persist only the query SHA-256, context and memory identifiers, scores, path, and provenance. Claims and query text remain outside this diagnostic record.
