# Kovacs V0.3.3 — Trust, Correction, and Retrieval

## Objective

V0.3.3 makes contextual guidance safer and more correct before expanding Kovacs into meeting or career workflows. It closes three gaps from V0.3.2: local sensitive-content handling, correction of interpreted calibration facts, and scoped memory retrieval with measurable quality.

## In scope

- Redact recognized secrets, credentials, email addresses, connection strings, and configured restricted terms before text can enter a reasoning prompt.
- Treat visible prompt-like instructions as untrusted screen data and prevent them from triggering automatic reasoning.
- Withhold a screenshot whenever local inspection detects sensitive content or OCR cannot inspect the captured image.
- Let the learner correct interpreted calibration facts locally, accept a fact as unknown, and inspect the resulting draft revision.
- Allow one explicit clarification submission to trigger exactly one schema-constrained Codex CLI call.
- Retrieve active memories through SQLite FTS5 plus the deterministic local vector, filtered by project, memory kind, and maximum sensitivity.
- Continue with FTS-only or lexical-only retrieval if vectors or FTS are unavailable.
- Store retrieval diagnostics as hashes, identifiers, scores, and provenance—not raw queries or memory claims.

## Invariants

- Codex CLI is the only model gateway. No direct OpenAI API client or API key is introduced.
- All model calls are attributable to a user action or a deterministic context decision.
- Raw screenshots, OCR text, accessibility text, window titles, and prompt contents remain non-durable.
- Kovacs advises and drafts only. It cannot click, type, send, submit, publish, or commit for the learner.
- Meeting Mode, Career Mode, and continuous model polling remain out of scope.

## Release boundary

The version is complete only when migrations are additive, legacy gates pass, the V0.3.3 smoke test passes, and the fixed retrieval corpus reaches at least 80% Top-5 recall without a model call.
