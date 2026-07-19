# V0 Scenario Catalog

Status: normative
Executable definitions: `v0/scenarios.ts`

The suite contains 24 representative scenarios spanning:

- ordinary activity noise;
- deep-focus protection;
- single and repeated failures;
- stuck detection;
- critical security and data-loss risks;
- cooldown behavior;
- explicit assistance and assessment requests;
- restricted data;
- meeting consent granted, denied, and unknown;
- meeting questions and commitments;
- social and document review;
- progress, commits, and verified transfer evidence;
- prompt injection in observed screen content;
- precedence conflicts such as risk versus cooldown and privacy versus explicit request.

## Coverage matrix

| Concern | Scenarios |
|---|---|
| Noise and silence | S01, S14, S19 |
| Normal progress | S02, S15, S16, S17, S18 |
| Learning intervention | S03, S04 |
| Critical risk | S05, S06, S20 |
| Explicit user authority | S11, S12, S21, S24 |
| Cooldown | S13, S20 |
| Restricted data | S07, S23 |
| Meeting consent | S08, S09, S18, S22 |
| Communication review | S10, S24 |
| Memory classes | S02, S15, S16, S17, S18 |
| Prompt injection | S19 |
| Rule precedence | S20, S21, S22, S23 |

Each executable scenario declares its expected decision, intervention type, reason code, memory disposition, and at least one unacceptable outcome.
