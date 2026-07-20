# V0.3.0 State Machine

## Operating hierarchy

```text
unconfigured
  -> setup_proposed
  -> configured
  -> week_proposed
  -> configured
  -> day_proposed
  -> day_active
  -> day_ended
  -> configured
```

Only explicit confirmation transitions `setup_proposed`, `week_proposed`, or `day_proposed` into durable active state.

## Observation lifecycle

```text
idle -> observing <-> paused
                    <-> private
observing|paused|private -> ended
```

- `day_active` starts the V0.2 observer in `observing`.
- Restart recovery converts observing/private to paused.
- Only the user-triggered End Day path produces the debrief and ended state.
- No inactivity timer closes or debriefs a day.

## Checkpoint lifecycle

```text
active -> completed
pending -> active -> completed
```

Recording evidence closes the active checkpoint and activates the next pending checkpoint locally. This does not require a Codex call. V0.3 does not fabricate checkpoint completion from screen activity.

## Consequential-change policy

- Checkpoint activation after evidence: automatic.
- Plan generation: automatic proposal.
- Daily objective replacement: requires plan confirmation.
- Weekly outcome replacement: requires confirmation.
- 90-day mission creation or replacement: requires confirmation.
- Inferred memory: pending confirmation.
- User-stated routine and context: durable and editable.
