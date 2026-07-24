# Release process

Kovacs releases are evidence-bearing checkpoints, not feature labels.

## Preconditions

- The intended release scope is documented.
- The working tree contains no private or generated artifacts.
- The changelog describes user-visible, security, migration, and operational
  changes.
- The repository has an explicit license appropriate for the intended release.
- Compatibility changes to schemas, SQLite, IPC, or local-data paths have an
  explicit migration and recovery path.
- The supported release line in `SECURITY.md` is current.

## Automated gate

Use the declared Node version and install only the lockfile graph:

```powershell
npm ci
npm run ci
```

The GitHub Actions Windows quality gate must pass for the release commit.

## Live acceptance

Live acceptance is deliberately separate from CI because it requires an
authenticated Codex CLI and consumes model usage:

```powershell
npm run acceptance:live -- "C:\path\to\an\authorized\project"
```

Record only aggregate results. Do not attach prompts, responses, screenshots,
transcripts, window titles, local paths, databases, or learner memory to a
release.

## Version and tag

1. Update `package.json` and `package-lock.json` to the same version.
2. Move the relevant changelog entries from `Unreleased` into a dated release.
3. Run the automated and live gates.
4. Commit the release metadata.
5. Create an annotated tag:

   ```powershell
   git tag -a vX.Y.Z -m "Kovacs vX.Y.Z"
   ```

6. Push the commit and tag without force:

   ```powershell
   git push origin main
   git push origin vX.Y.Z
   ```

7. Create a GitHub Release from the tag using the changelog entry as the basis.

## Release evidence

Report these categories separately:

- deterministic automated checks;
- live Codex acceptance;
- real-world pilot results.

Never present repository tests or a synthetic benchmark as production
effectiveness.

## Rollback

Before a migration-bearing release, produce and inspect a user-triggered backup.
If a release fails, preserve the database, capture only redacted diagnostics, and
return to the previous tagged build. Never solve migration failures by deleting
user data.
