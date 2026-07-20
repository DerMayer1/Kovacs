# V0.3.0 Memory and Competence

## Evidence record

Every retained evidence item includes source, project, day, competency, assistance level, outcome, confidence, summary, validation reference, and timestamp.

Sources are intentionally distinct:

- `observed`: Kovacs saw relevant activity, but the result is not proven;
- `self_reported`: the user stated an outcome;
- `tool_verified`: an identified tool produced the validation;
- `artifact_verified`: a concrete artifact supports the claim;
- `reviewed`: the claim received an explicit later review.

Observation alone never proves competence.

## Competencies

V0.3 tracks:

- software design and implementation;
- AI systems;
- debugging and operational judgment;
- architecture;
- testing and reliability;
- security and privacy;
- product judgment;
- technical communication;
- leadership and leverage;
- execution and ownership.

Levels are `unverified`, `emerging`, `practiced`, `reliable`, `independent`, and `leverage`. Advancement is deterministic and weights validated outcomes, lower assistance, repeated evidence, and independence. The UI exposes level, confidence, and evidence count but does not convert them into a productivity score.

## Memory

Memory kinds are main goal, routine, context, pattern, and lesson. Each record has epistemic source, confidence, sensitivity, status, pin state, and timestamps.

- Explicit calibration facts can become active memory immediately.
- Inferred patterns remain pending until confirmed.
- Sensitive conclusions are never silently promoted.
- Every record can be confirmed, pinned, unpinned, or deleted.
- Raw screenshots, captions, audio, full browser contents, and authentication material are not memory.
