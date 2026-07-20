# V0.3.1 Migration and Recovery

## Database migration

`V03Store.create()` opens the existing `%LOCALAPPDATA%\Kovacs\v0.3\kovacs.db`, enables WAL and foreign keys, creates new tables, and adds missing columns only after checking `PRAGMA table_info`. The durable schema marker then advances from `0.3.0` to `0.3.1`.

SQLite `secure_delete` is enabled. Explicit and retention-driven memory deletions checkpoint WAL after removing unpinned records so the product does not describe a logical row deletion as sufficient privacy hygiene.

Setup, week, day, memory, and evidence JSON keep the compatible V0.3 wire marker where their existing shape is still valid. New recovery, retention, deterministic-summary, feedback, and database metadata use `0.3.1`. The application version and durable database schema are therefore newer without forcing Codex to generate a different planning contract.

Legacy evidence migration is deliberately conservative:

- `user_reported` becomes `self_reported`;
- legacy `validated` also becomes `self_reported` because V0.3 did not retain enough provenance to prove whether a tool or artifact performed the validation;
- new evidence becomes verified only through an explicit source selection or later review.

Legacy `skipped` checkpoints become `abandoned`. The legacy constrained status column remains compatible while `lifecycle_status` carries the expanded V0.3.1 state.

## Startup recovery

Startup runs `PRAGMA integrity_check`. A non-`ok` result fails explicitly rather than silently rebuilding or deleting data.

Every model call that V0.3.1 owns is first written with status `started`. Completion changes it to `success`, `failed`, or `discarded`. Startup converts any remaining `started` row to `interrupted` and records that fact in the recovery snapshot.

An active day, pending draft, and current checkpoint remain durable. Screen observation is controlled by the V0.2 recovery boundary and returns paused. The pet tells the user what was recovered and requires an explicit resume.

## Backup and export

Backup is user-triggered from the Memory view. Kovacs checkpoints WAL, uses SQLite `VACUUM INTO` for a consistent database copy, and writes a separate JSON export of structured state. Both files are placed under `Documents\Kovacs Backups` with timestamped names.

Exports contain structured profile, active plan, competencies, memories, local usage metrics, retention, and feedback. They contain no raw frames or window titles. Backup files inherit the operating-system permissions of the destination; V0.3.1 does not claim encryption-at-rest.

## Recovery operator checks

1. Start a day and leave one checkpoint active.
2. Close Kovacs without End Day.
3. Relaunch and verify the day is shown, observation is paused, and no duplicate day exists.
4. Create a pending proposal, relaunch, and verify it still requires confirmation.
5. Run backup, open the JSON export, and inspect exactly what is durable.
6. Run `npm run v031:smoke` after any schema change.
