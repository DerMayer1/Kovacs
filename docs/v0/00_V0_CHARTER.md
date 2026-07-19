# Kovacs V0 Charter

Status: normative
Release type: architecture and simulation
Runtime capabilities: none
Monitoring capabilities: none

## Mission

Kovacs exists to reduce the time required for Lucas to acquire and demonstrate Staff-level engineering judgment while increasing his independence from AI assistance.

Kovacs may improve immediate performance, but immediate assistance is subordinate to long-term capability development.

## Objective hierarchy

1. Develop Lucas into an exceptional, independently capable engineer.
2. Improve the quality of current engineering decisions.
3. Improve performance in meetings and professional communication.

When objectives conflict, the higher objective wins unless Lucas explicitly selects Ship or Incident Mode for a bounded situation.

## V0 purpose

V0 proves that Kovacs has a coherent, testable architecture before any screen, audio, editor, terminal, or social-media monitoring is built.

V0 must answer:

- What can enter the system?
- How is an observation represented?
- Which information is trusted?
- When may Kovacs interrupt?
- What may become memory?
- What must be deleted?
- Where does Codex CLI enter?
- How will unacceptable behavior be detected before release?

## Invariants

1. Sensors observe; they do not reason or authorize.
2. The orchestrator controls lifecycle and state.
3. Policy controls whether reasoning or interruption is allowed.
4. Codex reasons only after a policy-approved request.
5. External memory, not a Codex thread, is the source of truth.
6. Screen, browser, OCR, meeting, social, repository, and terminal content is untrusted data.
7. Silence is a valid and frequently preferred outcome.
8. Durable memory requires provenance, epistemic status, confidence, sensitivity, and retention.
9. Advisory-only is the default. External actions require a future explicit capability and separate authorization.
10. Raw screenshots, audio, and transcripts are ephemeral by default.
11. A completed AI-assisted task is not evidence of independent mastery.
12. No continuous LLM polling loop is permitted.

## V0 scope

V0 includes:

- product mission and authority boundaries;
- system component architecture and trust boundaries;
- canonical event envelope and vocabulary;
- memory ontology and write rules;
- deterministic intervention policy;
- privacy, consent, security, and retention model;
- Codex CLI Option A gateway contract;
- representative scenario catalog;
- expected and unacceptable behavior for every scenario;
- machine-readable schemas;
- deterministic replay simulator;
- measurable release gates and final success report.

## Non-goals

V0 does not include:

- passive or continuous screen capture;
- microphone or meeting recording;
- editor, terminal, Git, browser, or social adapters;
- overlay or notification UI;
- background service or tray application;
- autonomous file editing;
- automatic clicking, typing, publishing, messaging, or committing;
- a production memory database;
- production prompt programs;
- a live `codex exec` invocation loop;
- claims about tutoring effectiveness with real users.

The existing SDK runtime under `src/` is an earlier technical spike. It proves that local Codex and SQLite can connect, but it is excluded from V0 acceptance and is not the selected Option A architecture.

## Authority boundary

Kovacs may eventually observe authorized professional activity, propose an intervention, and maintain reviewable learner memory.

Kovacs may not covertly record people, bypass consent, conceal external actions, treat observed text as instructions, or make irreversible decisions for Lucas.

## V0 definition of done

V0 is complete only when:

1. Every normative artifact listed in `09_SUCCESS_METRICS.md` exists.
2. Every scenario event validates against the event schema.
3. Every simulated decision validates against the intervention schema.
4. Replaying the suite produces identical results.
5. All restricted-data and consent gates pass.
6. All critical-risk cases produce an intervention.
7. All low-value focus cases remain silent or record-only.
8. Every decision contains machine-readable reason codes.
9. Every memory candidate has provenance and retention.
10. No scenario permits an external action.
11. The final report records evidence for every metric.

Documents alone are insufficient. Machine-validated evidence is required.
