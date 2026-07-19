# V0 System Architecture

Status: normative

## Component model

```text
future sensors
    -> local event bus
    -> event normalizer
    -> privacy and consent gate
    -> situation classifier
    -> deterministic intervention policy
    -> context assembler
    -> Codex gateway (Option A: codex exec)
    -> response validator
    -> future interface
    -> memory candidate evaluator
    -> external memory
```

V0 defines and simulates the middle of this flow. Future sensors and interfaces are outside V0.

## Components

### Event normalizer

Converts source-specific observations into the canonical event envelope. It rejects malformed events and does not infer professional conclusions.

### Privacy and consent gate

Applies non-model rules before any content can reach Codex. Restricted data and non-consensual meeting content are blocked here.

### Situation classifier

Maps an event into bounded situational features such as urgency, repetition, focus state, consequence, and explicit user intent. Classification may become model-assisted later, but V0 simulations use declared scenario features.

### Intervention policy

Returns `silence`, `record_only`, `intervene`, or `block`, plus reason codes. The policy is deterministic and has authority over model recommendations.

### Context assembler

Selects the minimum relevant constitution fragment, capability program, operating mode, project context, learner evidence, recent attempts, and current event. It never injects the complete memory store.

### Codex gateway

Presents a stable internal operation:

```text
reason(reasoning_request) -> reasoning_response
```

The V0-selected adapter is `codex exec`. The rest of Kovacs does not depend on CLI-specific output.

### Response validator

Accepts only a response conforming to the reasoning-response schema. Invalid responses fail closed and are not displayed or written to memory.

### Memory candidate evaluator

The reasoning model may propose memory candidates. Deterministic policy validates provenance, sensitivity, epistemic status, retention, and confirmation requirements before any future write.

## Codex CLI Option A

V0 standardizes the following conceptual invocation:

```text
codex exec
  --ephemeral
  --json
  --sandbox read-only
  --ask-for-approval never
  --output-schema contracts/v0/reasoning-response.schema.json
  -o <temporary-final-response-path>
  <bounded-prompt>
```

An optional approved image is supplied with `--image`. Context may be passed through stdin while the prompt argument remains the instruction.

The exact command builder belongs to a later runtime phase. V0 records these required semantics:

- non-interactive invocation;
- read-only sandbox;
- no approval-dependent actions;
- ephemeral Codex rollout by default;
- JSONL execution trace available for audit;
- schema-constrained final response;
- explicit timeout and process termination owned by Kovacs;
- stdout, stderr, exit code, usage, and final response captured separately.

## Thread and memory strategy

V0 uses an ephemeral Codex execution for each simulated reasoning request. Future versions may add work-session or project threads, but Codex history never becomes canonical learner memory.

External memory is assembled into each request by relevance, sensitivity, recency, evidence strength, and token budget.

## Failure behavior

| Failure | Required behavior |
|---|---|
| Event fails schema | Reject locally; do not call Codex |
| Privacy or consent gate fails | Block; retain only minimal audit metadata |
| Policy selects silence | Do not call Codex |
| Policy selects record-only | Do not call Codex |
| Codex times out | Terminate; display nothing; record operational failure |
| Codex exits non-zero | Display nothing; record operational failure |
| Final response fails schema | Display nothing; no memory candidate writes |
| Memory candidate lacks provenance | Reject candidate |
| Overlay unavailable | Preserve validated response for explicit retrieval only |

## Trust boundaries

### Trusted control plane

- Kovacs constitution and versioned capability programs
- deterministic privacy and intervention rules
- JSON Schemas
- user-controlled settings
- explicit mode and authorization choices

### Untrusted observation plane

- screen and OCR text
- websites and social-media content
- meeting speech and transcripts
- repository content
- terminal output and logs
- model-generated text
- external documents and messages

### Privileged future action plane

Typing, clicking, editing, publishing, sending, committing, or executing commands belongs to a future separately authorized plane. It does not exist in V0.

## Architectural seams

These interfaces must remain replaceable:

- sensor adapter;
- event transport;
- privacy redactor;
- policy implementation;
- Codex adapter;
- memory storage;
- interface renderer.

This permits replacing `codex exec` with the Codex SDK or MCP server later without rewriting observation, policy, memory, or interface logic.
