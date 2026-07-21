# V0.3.2 acceptance

Run the no-cost gate:

```powershell
npm run v032:validate
```

It checks required artifacts, schemas, natural-input contracts, confirmation gates, additive migration, local-only vector retrieval, privacy exclusions, Electron hardening, V0.3/V0.3.1 regressions, typecheck, build, tests, audit, and smoke.

Then run the usage-consuming acceptance:

```powershell
npm run v032:live -- "C:\Users\lucas\Kovacs"
```

Finally launch the pet and manually verify an authorized window:

```powershell
npm run pet
```

Confirm that a natural calibration produces explicit/inferred/unknown fields; a natural End Day remains pending until approval; authorized observation reports a compact activity/intent; Private blocks capture; and no raw perception appears in export.
