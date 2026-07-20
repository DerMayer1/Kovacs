# V0.3.0 Token Economy

V0.3 optimizes model use by separating deterministic state from interpretation.

## No-call work

The following remain local and require no Codex invocation:

- timers and state transitions;
- active-window authorization;
- frame-difference filtering;
- pause/private enforcement;
- checkpoint progression;
- evidence persistence;
- competency recalculation;
- memory pin, confirm, and delete;
- duplicate and cooldown suppression;
- usage aggregation.

## Justified calls

Codex is used for:

- initial 90-day mission proposal;
- explicit new-week proposal;
- daily objective challenge and checkpoint proposal;
- meaningful or user-requested coaching intervention;
- explicit End Day debrief.

Only one ambient reasoning request runs at a time. Structured summaries replace replaying full history. Images are attached only when metadata and current operating context are insufficient.

## Metrics

V0.3.1 records invocation reason, urgency, duration, prompt and response characters, whether an image was attached, cache status, completion state, response use, and timestamp. Characters are stable local context-size proxies; they are not presented as exact provider tokens or billing counts.
