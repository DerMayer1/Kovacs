# Kovacs V0 Success Report

Release: V0
Policy version: `v0.1.0`
Contract version: `0.1.0`
Evaluation date: 2026-07-19
Status: passed

## Outcome

Kovacs V0 has completed the architecture-and-simulation phase. All 16 release metrics pass with zero scenario failures.

V0 establishes a tutor-first objective hierarchy, deterministic policy authority, external governed memory, Codex CLI Option A behind a replaceable gateway, fail-closed privacy behavior, and a complete contract set for future runtime work.

## Evidence summary

| Evidence | Result |
|---|---:|
| Required normative artifacts | 21/21 present |
| Representative scenarios | 24 |
| Valid scenario and event contracts | 24/24 |
| Valid intervention decisions | 24/24 |
| Deterministic five-run replays | 24/24 |
| Reasoning-triggering scenarios | 11 |
| Valid simulated reasoning requests | 11/11 |
| Valid simulated reasoning responses | 11/11 |
| Valid governed memory candidates | 5/5 |
| Restricted-data cases safely blocked | 2/2 |
| Missing-consent cases safely blocked | 2/2 |
| Eligible critical-risk cases intervened | 3/3 |
| Deep-focus cases protected | 2/2 |
| Decisions with reason codes | 24/24 |
| Decisions allowing external action | 0/24 |
| Prompt-injection containment cases | 1/1 |

The authoritative live result is produced by:

```text
npm run v0:validate
```

## Metric results

- M01 Normative artifact completeness: pass.
- M02 Scenario contract validity: pass.
- M03 Intervention contract validity: pass.
- M04 Deterministic replay: pass.
- M05 Restricted-data hard gate: pass.
- M06 Meeting-consent hard gate: pass.
- M07 Critical-risk recall: pass.
- M08 Focus protection: pass.
- M09 Explainable decisions: pass.
- M10 Memory provenance and retention: pass.
- M11 Reasoning request/response contracts: pass.
- M12 No external actions: pass.
- M13 Prompt-injection containment: pass.
- M14 Option A execution contract: pass.
- M15 V0 scope contains no sensor implementation: pass.
- M16 Expected outcomes and unacceptable behaviors: pass.

## What V0 proves

- The system has explicit authority and trust boundaries.
- Events, decisions, reasoning requests, responses, scenarios, and memory candidates have machine-readable contracts.
- Privacy and consent gates take precedence over urgency and explicit requests.
- Critical risks take precedence over cooldown.
- Explicit requests take precedence over focus protection.
- Normal progress does not automatically become capability evidence.
- Observed prompt injection cannot authorize Codex or external actions in the tested case.
- The deterministic policy is replayable and explainable.
- The selected `codex exec` integration semantics are documented without coupling the architecture to the CLI.

## What V0 does not prove

- Real model responses are pedagogically effective.
- Screen, editor, terminal, meeting, or social sensors are safe or accurate.
- Intervention timing works during real focused work.
- Privacy redaction works on real content.
- Long-term memory improves outcomes.
- The overlay experience is useful.
- `codex exec` latency is acceptable.

These are deliberately deferred. Claiming them from V0 would be false maturity.

## First failed gate and correction

The first validation run passed 15/16 metrics. M15 incorrectly scanned the validator's own forbidden-token list and reported sensor implementations that did not exist. The scan boundary was corrected to inspect the V0 policy and scenario implementation. The metric itself was not weakened. The subsequent run passed 16/16.

## Release decision

V0 is complete. The repository may proceed to V0.1 only after defining V0.1 success metrics. V0.1 should remain manual and tutor-focused: explicit user invocation, bounded `codex exec`, schema-validated responses, and no passive monitoring.
