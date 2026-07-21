# Context pipeline

1. The existing authorization policy accepts or rejects the active window. Denied, paused, and private states stop here.
2. Windows UI Automation reads permitted semantic text without capturing the window.
3. `LocalContextEngine` normalizes UIA into a confidence-bearing frame and deterministic fingerprint. Sufficient unchanged context stops locally with zero capture and zero model call.
4. Only when UIA is insufficient does the lazy capture callback produce an invocation-scoped frame for local OCR.
5. OCR is combined with UIA and evaluated again. If the combined local context is sufficient, the frame is deleted locally and no image is attached to Codex.
6. Only when UIA and OCR remain insufficient may the already-captured temporary screenshot be attached to a justified Codex call.
7. Only a compact `ContextFrame` is stored: application, project, activity category, artifact name when confidently found, visible intent, active checkpoint, privacy class, confidence, ambiguity, signal sources, changed fields, and SHA-256 digest.
8. Approved active memories are retrieved locally with lexical and feature-hashed vector similarity. Each recalled item carries source and index provenance.
9. Every OCR and Codex image file is removed in `finally`, including failure paths.

Raw OCR text, accessibility text, screenshots, and window titles have no durable column and are absent from backup/export. `last_capture_at` changes only when the lazy cascade actually requests a frame.
