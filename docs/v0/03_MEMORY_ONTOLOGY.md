# V0 Memory Ontology

Status: normative
Machine contract: `contracts/v0/memory-candidate.schema.json`

## Principle

Conversation history is not learner memory. A memory is a governed claim with provenance and a defined lifecycle.

## Memory classes

### Working memory

Current objective, active hypothesis, open problem, recent attempts, and temporary meeting or coding context.

- Default retention: session
- May be inferred
- Never used as long-term capability evidence without promotion

### Episodic memory

A compact account of a specific event or completed session.

- Default retention: 30 days
- Must reference source events
- Used for later reflection and pattern detection

### Semantic memory

Stable facts about projects, workflows, preferences, constraints, or explicitly confirmed goals.

- Default retention: until reviewed
- User-stated or verified facts preferred
- Conflicting facts remain visible until resolved

### Evidence memory

Verified demonstrations or counterevidence for a capability.

- Default retention: until reviewed
- Requires an artifact or assessment reference
- Records assistance level
- Cannot be created from model praise or task completion alone

### Commitment memory

Decisions, promises, owners, deadlines, and follow-up obligations.

- Retention: until completed plus review period
- Meeting-derived commitments require consent
- Must retain exact source and confidence

### Pattern memory

Repeated behavior across independent observations, such as editing before reproducing a failure.

- Default retention: 90 days before review
- Requires at least three supporting episodes or explicit confirmation
- Must include counterexamples
- Must describe behavior, never identity

### Curriculum memory

Concepts introduced, retrieval results, transfer performance, and next assessment.

- Retention: until the capability cycle is reviewed
- Exposure and mastery are distinct states
- Assistance level is mandatory

### Professional memory

Sanitized evidence suitable for CV, portfolio, technical writing, or public positioning.

- Retention: until reviewed
- Requires explicit confidentiality review
- Publication remains human-controlled

## Epistemic status

Every candidate is one of:

- `user_stated`
- `observed`
- `inferred`
- `verified`

Inference must never be rendered as fact. Verification requires a named method or evidence reference.

## Required candidate fields

- stable candidate ID;
- memory class;
- claim;
- epistemic status;
- source event IDs;
- confidence from 0 to 1;
- sensitivity;
- retention class;
- expiration when applicable;
- evidence reference when applicable;
- confirmation requirement;
- policy version.

## Write pipeline

```text
model or deterministic rule proposes candidate
    -> schema validation
    -> provenance validation
    -> sensitivity and consent gate
    -> class-specific evidence gate
    -> conflict detection
    -> optional user confirmation
    -> durable write
```

The model proposes. The memory policy decides.

## Promotion rules

- Working -> episodic: session produces a meaningful outcome.
- Episodic -> pattern: at least three independent episodes support the behavior.
- Episodic -> evidence: an artifact or assessment verifies capability.
- Evidence -> professional: confidentiality review passes and the claim is suitable for external representation.
- Curriculum exposure -> mastery: later retrieval and transfer succeed with low assistance.

## Rejection rules

Reject a candidate when:

- no source event exists;
- sensitivity is restricted;
- consent is missing for meeting-derived content;
- a capability claim lacks an artifact or assessment;
- a pattern is based on fewer than three episodes;
- the claim is an identity judgment;
- retention is missing;
- confidence is presented without epistemic status;
- the content is merely a restatement of model output.

## Conflict and correction

New memory does not silently overwrite conflicting memory. Store the conflict, lower retrieval confidence, and request confirmation or new evidence. Lucas can inspect, correct, export, or delete memory.

## Retrieval

Retrieve by current task, project, mode, capability relevance, confidence, sensitivity, recency, and token budget. Sensitive memory is not retrieved for social or public-writing contexts unless explicitly required and authorized.
