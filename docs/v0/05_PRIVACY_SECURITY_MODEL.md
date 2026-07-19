# V0 Privacy and Security Model

Status: normative

## Privacy posture

Kovacs is local-first, allowlist-first, ephemeral-by-default, and visible to Lucas. It is not designed for covert recording or evasion.

## Data classes

| Class | Examples | Codex eligible | Durable memory |
|---|---|---:|---:|
| Public | Public documentation, published post | Yes | Governed |
| Internal | Lucas's project context | Yes when authorized | Governed |
| Sensitive | Private source, meeting transcript, personal draft | Only when required and authorized | Limited |
| Restricted | Passwords, tokens, banking, health portals, private keys, denied-consent content | No | No content retention |

## Consent

- Screen observation requires Lucas's explicit enablement and an application allowlist in future phases.
- Meeting capture requires appropriate participant notice and consent.
- Denied or unknown meeting consent blocks content processing.
- Social publishing always requires Lucas's final action.
- Consent is scoped and revocable; it is not inferred from previous use.

## Retention matrix

| Data | Default retention |
|---|---|
| Raw screenshot | Ephemeral, minutes |
| Raw audio | Ephemeral buffer only |
| Full transcript | Session unless explicitly retained |
| OCR text | Ephemeral |
| Structured event | 30 days unless promoted |
| Policy audit metadata | 90 days |
| Verified evidence | Until reviewed |
| Restricted content | Never retained |

Future implementations must make exact durations configurable and test deletion.

## Trust threats

### Prompt injection from observed content

Websites, terminals, source files, meeting speech, OCR, and social drafts may contain agent instructions. They are always wrapped as untrusted evidence. They cannot change the constitution, policy, tool permissions, memory rules, or requested mode.

### Secret exposure

Future sensors require application blocking, pattern-based redaction, protected-region handling, and a manual panic pause. Redaction happens before remote reasoning.

### Excessive surveillance

Continuous model processing is prohibited. Future local observation must be visible, pausable, scoped to approved applications, and governed by event thresholds.

### Incorrect memory

Memory requires provenance and epistemic status. Inferences remain labeled; capability and pattern claims require stronger evidence.

### Autonomous external action

V0 contains no action plane. Reasoning responses cannot authorize typing, clicking, editing, sending, publishing, committing, or executing commands.

### Overlay capture

A future private overlay may request capture exclusion, but this is not treated as a security guarantee. Kovacs does not promise undetectability.

## Failure posture

Kovacs fails closed:

- uncertain consent -> block;
- unknown sensitivity near credentials -> restricted;
- invalid redaction -> no remote reasoning;
- invalid model response -> no display or memory write;
- unavailable privacy service -> observation disabled;
- policy version mismatch -> event quarantined.

## User controls required before monitoring

- master pause and visible status;
- global panic hotkey;
- application allowlist and denylist;
- per-capability enablement;
- retention settings;
- memory viewer and deletion;
- session history and intervention log;
- consent state;
- export and full local-data deletion.

## Security acceptance conditions for later phases

No sensor phase may begin until application scoping, restricted-data blocking, consent state, prompt-injection containment, and raw-artifact expiry have executable tests.
