# Changelog

All notable changes to Kovacs are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and releases use [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Because Kovacs is pre-1.0, minor versions may still change compatibility
boundaries when accompanied by an explicit migration.

## Unreleased

### Added

- Windows GitHub Actions quality gate with locked dependency installation.
- Contributor, security, and release operating documentation.
- Canonical `npm run ci` command and Node version declaration.

### Changed

- Production modules, tests, release gates, and UI are organized by
  responsibility rather than active version folders.
- Direct and development dependencies are pinned to reviewed versions.

## 0.3.3 - 2026-07-21

### Added

- Local sensitive-content guard for text and screenshot escalation.
- Project-, kind-, status-, and sensitivity-scoped memory retrieval.
- Deterministic retrieval benchmark and redacted retrieval diagnostics.
- Calibration correction and explicit refinement flows.

### Security

- Prompt-injection-like screen content cannot trigger automatic reasoning.
- Sensitive or locally uninspectable screenshots fail closed.

## 0.3.2 - 2026-07-21

### Added

- UI Automation-first perception cascade with local OCR fallback.
- Deterministic context decision engine and scoped memory retrieval.
- Confirm-before-write calibration and end-day interpretation.

## 0.3.1 - 2026-07-20

### Added

- Additive SQLite migrations and restart recovery.
- Explicit evidence provenance, intervention feedback, backup, and export.
- Pilot protocol and live Codex acceptance boundary.
