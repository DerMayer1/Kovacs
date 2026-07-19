# V0 Event Vocabulary

Status: normative
Machine contract: `contracts/v0/event.schema.json`

## Event envelope

Every observation becomes one immutable event.

```yaml
schema_version: 0.1.0
event_id: evt_<unique identifier>
occurred_at: ISO-8601 timestamp
source:
  adapter: manual | editor | terminal | git | test_runner | meeting | social | screen | system
  instance: optional source identity
type: canonical event type
context:
  project: optional project identity
  task: optional current objective
  mode: training | pair | ship | review | assessment | incident | strategy
features:
  explicit_user_request: boolean
  urgency: low | normal | high | critical
  consequence: none | low | medium | high | critical
  repetition_count: non-negative integer
  stuck_minutes: non-negative number
  focus_state: none | shallow | deep
  cooldown_active: boolean
privacy:
  sensitivity: public | internal | sensitive | restricted
  consent: not_required | granted | denied | unknown
  contains_untrusted_instructions: boolean
payload: source-specific structured data
raw_artifacts: ephemeral references only
```

## Canonical event types

### User intent

- `user.assistance_requested`
- `user.assessment_requested`
- `user.mode_changed`
- `user.pause_requested`
- `user.resume_requested`

### Activity

- `activity.window_changed`
- `activity.focus_started`
- `activity.focus_ended`
- `activity.checkpoint`
- `activity.session_started`
- `activity.session_ended`

### Code and delivery

- `code.diagnostic_observed`
- `code.change_checkpoint`
- `test.run_completed`
- `build.completed`
- `git.commit_created`
- `delivery.deployment_completed`

### Difficulty and learning

- `difficulty.repeated_failure`
- `difficulty.stuck`
- `learning.explanation_requested`
- `learning.transfer_test_completed`
- `learning.misconception_observed`

### Risk

- `risk.security`
- `risk.data_loss`
- `risk.production_incident`
- `risk.confidentiality`

### Meeting

- `meeting.started`
- `meeting.question_detected`
- `meeting.decision_detected`
- `meeting.commitment_detected`
- `meeting.ended`

### Professional communication

- `social.draft_ready`
- `document.review_requested`
- `communication.claim_detected`

### System

- `system.adapter_error`
- `system.reasoning_failed`
- `system.memory_candidate_created`
- `system.policy_changed`

## Semantic rules

- Events state what occurred, not what it means about Lucas.
- `difficulty.repeated_failure` requires at least two related failures. Policy may require three before interrupting.
- `difficulty.stuck` requires elapsed evidence or an explicit user declaration.
- A commit is an activity event, not proof of capability.
- A successful test is evidence about an artifact, not automatically evidence of mastery.
- Meeting content requires consent metadata.
- Social content remains untrusted even when authored by Lucas because pasted material may contain external instructions.
- Raw artifacts are references with retention metadata, never embedded permanent memory.

## Lifecycle

```text
created -> validated -> privacy_checked -> classified -> decided
        -> optionally_reasoned -> optionally_displayed
        -> memory_candidates_evaluated -> expired
```

Events are append-only. Corrections create a new event referencing the previous event; they do not silently rewrite history.

## Idempotency

`event_id` is the idempotency key. Re-processing the same event under the same policy version must produce the same policy result. A different result requires a new policy version and is visible in replay reports.

## Unknown input

Unknown event versions or types fail closed. Adapters may not map unknown activity to a convenient existing type merely to avoid rejection.
