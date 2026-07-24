# Kovacs operations

This document covers local diagnosis and support for the current Windows
prototype. It does not expand Kovacs' authority or enable remote telemetry.

## Doctor

Run the local diagnostic before a pilot, after an upgrade, or when startup fails:

```powershell
npm run doctor
```

For machine-readable output:

```powershell
npm run doctor -- --json
```

After a package build or installation, the equivalent commands are:

```powershell
kovacs doctor
kovacs doctor --json
```

The doctor performs no model calls, captures no screen content, and creates no
application state.

## Checks

| Check | Purpose |
| --- | --- |
| Platform | Confirms the supported Windows runtime. |
| Node runtime | Requires Node 22.13.0 or newer for unflagged `node:sqlite`. |
| Contracts | Confirms current planning, context, and coaching schemas are readable. |
| Data directory | Reports whether the configured local directory exists and is accessible. |
| SQLite capability | Exercises SQLite and FTS5 only in an ephemeral in-memory database. |
| Database | Opens an existing Kovacs database read-only, runs `quick_check`, and verifies schema 0.3.3. |
| Codex CLI | Resolves the same native executable used by the reasoning gateway and reads its version. |
| Codex authentication | Runs the local `codex login status` command without invoking a model. |
| Windows helpers | Confirms PowerShell and the local UIA/OCR helper scripts are available. |

An absent data directory or database is a first-run warning. It is not initialized
by the doctor. Missing required runtime capabilities, corrupt state, or failed
authentication are failures.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | No required check failed. The report may contain first-run warnings. |
| `1` | One or more required checks failed. |

CLI argument or unexpected startup errors also return non-zero through the common
CLI boundary.

## Privacy

Human and JSON output use stable environment tokens such as `%LOCALAPPDATA%` and
`%USERPROFILE%` instead of usernames. Probe exceptions, command output, observed
content, credentials, database rows, and Codex authentication material are never
included.

The JSON contract reports:

- schema version and generation time;
- overall `pass`, `warn`, or `fail`;
- ordered check identifiers, labels, statuses, and bounded summaries;
- `model_calls: 0`.

It is suitable for a bug report after the user reviews it.

## Troubleshooting order

1. Repair unsupported Node or Windows runtime failures.
2. Repair PowerShell or missing helper-script failures.
3. Authenticate Codex locally when the executable passes but authentication fails.
4. Back up an existing database before investigating integrity or migration failures.
5. Run `npm run ci` after local capabilities are healthy.

Do not delete the local database to clear a failed diagnostic. Preserve it for
recovery and use only redacted output in an issue.
