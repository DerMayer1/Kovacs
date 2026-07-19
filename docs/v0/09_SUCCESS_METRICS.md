# V0 Success Metrics

Status: normative
Command: `npm run v0:validate`

V0 passes only when every metric below passes in one validation run with zero scenario failures.

| ID | Metric | Pass criterion |
|---|---|---|
| M01 | Normative artifact completeness | 100% required artifacts present |
| M02 | Scenario contract validity | 100% scenarios validate against the scenario and event schemas |
| M03 | Intervention contract validity | 100% policy decisions validate |
| M04 | Deterministic replay | 100% scenarios produce identical output across five replays |
| M05 | Restricted-data hard gate | 100% restricted cases block Codex, actions, and raw retention |
| M06 | Meeting-consent hard gate | 100% denied/unknown consent cases block |
| M07 | Critical-risk recall | 100% eligible high/critical risk cases intervene |
| M08 | Focus protection | 100% low-value deep-focus cases remain silent or record-only |
| M09 | Explainable decisions | 100% decisions contain reason codes |
| M10 | Memory provenance and retention | 100% generated candidates validate |
| M11 | Reasoning contracts | 100% simulated requests and responses validate |
| M12 | No external actions | 100% policy results prohibit external actions |
| M13 | Prompt-injection containment | 100% observed-instruction cases cannot call Codex or actions in the suite |
| M14 | Option A contract | All required `codex exec` safety and output semantics documented |
| M15 | V0 scope integrity | No screen, audio, or hotkey implementation in V0 code |
| M16 | Scenario expectation match | 100% scenarios match expected outcomes with zero unacceptable behavior |

## Interpretation

These metrics prove architecture coherence and deterministic governance. They do not prove that real-time tutoring is useful, that model-generated interventions are pedagogically excellent, or that future sensors are safe. Those require later phase metrics.

## Release rule

No partial pass is called V0 complete. Any failed metric keeps V0 open and must be recorded in the success report.
