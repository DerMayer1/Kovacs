# Security policy

Kovacs observes explicitly authorized local context and stores selected
engineering state. Privacy boundary failures are security issues, even when they
do not involve remote code execution.

## Supported versions

Kovacs is a pre-1.0 prototype. Security fixes are applied to the current release
line only.

| Version | Supported |
| --- | --- |
| 0.3.3 | Yes |
| Earlier releases | No |

## Reporting a vulnerability

Use GitHub private vulnerability reporting for this repository when available.
Do not include secrets, screenshots, transcripts, window titles, learner memory,
or exploit details in a public issue.

If private vulnerability reporting is unavailable, contact the repository owner
through their GitHub profile and request a private reporting channel. A minimal
public issue may state that a private security contact is needed, but must not
describe the vulnerability.

This project does not currently operate a bug bounty program or promise a fixed
response SLA. Reports will be acknowledged and triaged on a best-effort basis,
with priority given to issues that may expose private data or expand Kovacs'
authority.

## Security-relevant behavior

Please report:

- durable storage of raw screenshots, OCR, accessibility text, audio, transcripts,
  credentials, or window titles;
- screen content being interpreted as agent instructions;
- observation resuming without explicit user action;
- sensitive content reaching Codex without the local guard allowing it;
- external clicking, typing, sending, publishing, or repository mutation;
- cross-project memory disclosure;
- migration, backup, export, or deletion behavior that loses or exposes data;
- Electron sandbox, context isolation, IPC, or content-protection bypasses;
- arbitrary command execution through project paths or observed content.

## Safe reports

Use synthetic examples and redact local usernames, project names, paths, tokens,
and learner content. Include the Kovacs version, Windows version, reproduction
steps, expected boundary, and observed boundary.

The public threat and privacy model is documented in
[`docs/v0/05_PRIVACY_SECURITY_MODEL.md`](./docs/v0/05_PRIVACY_SECURITY_MODEL.md).
