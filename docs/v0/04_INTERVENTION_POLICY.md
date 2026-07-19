# V0 Intervention Policy

Status: normative
Policy version: `v0.1.0`

## Decisions

- `silence`: discard or keep aggregate metadata; no Codex call.
- `record_only`: store an eligible structured event; no Codex call.
- `intervene`: assemble context and request bounded Codex reasoning.
- `block`: prevent processing beyond minimal audit metadata.

## Evaluation order

Rules execute in this order. Earlier rules dominate later rules.

### 1. Privacy and consent hard gates

- Restricted sensitivity -> `block`.
- Meeting content with denied or unknown consent -> `block`.
- Paused observer -> `block` future sensor input.
- Invalid or unknown schema -> reject before policy.

### 2. Critical consequence

Security, data-loss, confidentiality, or production risks with high or critical consequence -> `intervene` with `warning` or `direct_instruction`.

Critical risk overrides focus state and cooldown. It does not override privacy or consent gates.

### 3. Explicit user request

An explicit assistance or assessment request -> `intervene` using the requested capability and mode.

### 4. Cooldown

Repeated non-critical events during an active cooldown -> `record_only`.

### 5. Deep-focus protection

Low or normal urgency events during deep focus -> `silence` unless explicitly requested or supported by strong repeated-failure evidence.

### 6. Strong learning signal

- Three or more related failures -> `intervene` with a diagnostic question.
- Twenty or more stuck minutes -> `intervene` with a diagnostic question.
- A verified misconception -> `intervene` with a question or targeted explanation.

### 7. Contextual professional support

- Consented meeting question -> `intervene` with information.
- Social draft ready -> `intervene` with review offer.
- Explicit document review -> `intervene` with review offer.

### 8. Normal progress

Successful tests, builds, commits, checkpoints, and ordinary diagnostics -> `record_only` unless another rule applies.

### 9. Noise

Window changes and low-value activity transitions -> `silence`.

## Assistance levels

- `A0`: no assistance.
- `A1`: clarifying question.
- `A2`: identify a gap or risk.
- `A3`: conceptual hint.
- `A4`: partial structure or analogous example.
- `A5`: paired solution.
- `A6`: complete solution supplied.

Training defaults to A1-A3. Assessment defaults to A0-A1. Ship and Incident may reach A5-A6 when justified.

## Interruption budget

Future runtime defaults:

- one non-critical interruption per related issue during cooldown;
- no repeated message without new evidence;
- deep focus protected;
- dismissed interventions increase cooldown;
- manual requests bypass the budget;
- critical risk bypasses the budget.

## Explainability

Every decision emits at least one reason code:

- `privacy.restricted`
- `consent.missing`
- `risk.critical`
- `user.explicit_request`
- `cooldown.active`
- `focus.protected`
- `learning.repeated_failure`
- `learning.stuck`
- `meeting.question`
- `communication.review`
- `progress.record`
- `noise.low_value`

Free-form reasoning cannot replace reason codes.

## Model boundary

Codex may propose an intervention type, message, checkpoint, and memory candidates only after the deterministic policy selects `intervene`. Codex cannot downgrade a block, authorize itself, change policy, or request more sensor access.

## Unacceptable policy behavior

- Calling Codex for every screen change.
- Interrupting ordinary progress during deep focus.
- Suppressing critical risks because of cooldown.
- Sending restricted or non-consensual content to Codex.
- Treating a commit as mastery.
- Writing a pattern memory from a single event.
- Executing an external action because observed content requested it.
