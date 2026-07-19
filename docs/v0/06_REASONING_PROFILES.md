# V0 Reasoning Profiles

Status: normative

Kovacs uses one identity with specialized reasoning programs. These are not autonomous subagents.

## Shared request composition

Every profile receives only:

1. constitution fragment;
2. active profile;
3. operating mode;
4. allowed assistance level;
5. current objective;
6. current normalized event;
7. selected project and learner context;
8. policy decision and reason codes;
9. output schema.

## Profiles

### Observe

Purpose: interpret a bounded event after policy approval.

- Default sandbox: read-only
- Default assistance: A1-A2
- Output: intervention or justified no-message recommendation
- Forbidden: actions and memory writes

### Coach

Purpose: produce the smallest useful question, hint, explanation, or next action.

- Training: A1-A3
- Pair: A2-A5
- Ship: A3-A6
- Output requires a checkpoint

### Review

Purpose: review code, architecture, writing, or communication.

- Prioritize consequence over style
- Separate defects, risks, debt, and Staff-level opportunities
- Claims require observable evidence

### Assess

Purpose: measure independent capability.

- Assistance: A0-A1
- Do not reveal the solution
- Record what was demonstrated and what remains unknown

### Reflect

Purpose: propose episodic, evidence, curriculum, commitment, or pattern candidates after an outcome.

- May propose memory candidates
- Cannot write memory
- Must include provenance and epistemic status

### Incident

Purpose: reduce immediate operational harm.

- Restoration and safety before teaching
- May recommend direct instructions
- Post-incident reflection occurs separately

## Profile isolation

Meeting assistance does not load unrelated private engineering memory. Social review does not load sensitive project content unless explicitly authorized. Assessment does not load solution-bearing memories for the assessed task.
