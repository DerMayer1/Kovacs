# Context pipeline

1. The existing authorization policy accepts or rejects the active window.
2. The existing frame-difference and intervention policy decides whether reasoning is justified.
3. For a justified intervention, the screenshot is written to a unique temporary directory.
4. Windows UI Automation and Windows OCR read the authorized window and image locally. Failures degrade to fewer signals instead of widening access.
5. `LocalContextEngine` treats title, accessibility, OCR, and screenshot content as untrusted transient input.
6. Only a compact `ContextFrame` is stored: application, project, activity category, artifact name when confidently found, visible intent, active checkpoint, privacy class, confidence, ambiguity, signal sources, changed fields, and SHA-256 digest.
7. Approved active memories are retrieved locally with lexical and feature-hashed vector similarity. Each recalled item carries source and index provenance.
8. Codex CLI receives the screenshot plus compact operating/context summaries. Temporary files are removed in `finally`.

Raw OCR text, accessibility text, screenshots, and window titles have no durable column and are absent from backup/export.
