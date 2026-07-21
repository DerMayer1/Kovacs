# Context Decisions and Lifecycle

## Purpose

Kovacs should understand enough context to point the user toward the highest-leverage next move without turning every screen change into a model call. This layer is deterministic, local, inspectable, and independent from Codex output.

## Confidence gate

| Observation | Automatic result |
| --- | --- |
| Confidence below 0.65 | Silence |
| Confidence 0.65-0.79 | Continuity only; no call |
| Confidence at least 0.80 with conflicting signals | Silence |
| Confidence at least 0.80 with weak delta | Silence |
| Confidence at least 0.80 with stable strong delta | Eligible call |
| Deterministic error/test signal | Immediate eligible call |
| Manual Observe Now | Call regardless of confidence |

Screenshots remain ephemeral. Automatic attachment is limited to unresolved local context or deterministic error/test verification; a manual observation may also attach the authorized window.

## Context delta

Application, project, activity, artifact, and active checkpoint are strong fields. Text digest, cursor movement, scrolling, and visual movement alone are weak. A strong change must remain stable for two observations, approximately three seconds under default sampling. A deterministic failure does not wait for stability.

The same semantic context has a sixty-second cooldown. New project, application, checkpoint, deterministic failure, and manual observation can bypass the global scheduler. Repeated identical failures still respect the same-context cooldown. `wrong_context` feedback suppresses that semantic fingerprint for the current session only.

## Lifecycle

- Working context: RAM only, ten-minute TTL.
- Clear boundaries: Pause, Private, End Day, and process restart.
- Durable context: created only for intervention, feedback, checkpoint, evidence, or End Day events.
- Ordinary compact context and feedback: fourteen days.
- Evidence-linked context: retained with evidence.
- Decision and invocation telemetry: thirty days.
- Pinned approved memory: indefinite until the user unpins or deletes it.

Raw screenshots, accessibility text, OCR text, and window titles never enter SQLite, diagnostics, backup, or JSON export. Context Diagnostics shows only the decision, reason, confidence, perception path, semantic delta fields, and whether an ephemeral image was attached.

## Failure behavior

Conflicts and low confidence fail silent. Missing local perception does not infer a context from a window title. Restart does not reconstruct working context or resume observation. Retention removes expired event associations first and deletes only context frames no longer linked to a retained event or evidence record.
