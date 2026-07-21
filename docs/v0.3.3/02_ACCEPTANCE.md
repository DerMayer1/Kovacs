# V0.3.3 acceptance

Run:

```powershell
npm run v033:validate
```

The automated gate requires:

- all V0.3.2 regression metrics pass;
- TypeScript typecheck, full tests, build, renderer syntax checks, and high-severity dependency audit pass;
- sensitive text is redacted locally and sensitive or uninspectable screenshots are withheld;
- visible prompt-injection-like content cannot trigger an automatic Codex call;
- calibration corrections are versioned, local, and call-free;
- one explicit clarification submission produces one planner invocation;
- retrieval applies project, kind, status, and sensitivity filters;
- corrupt vectors fall back to FTS, and unavailable FTS falls back to local lexical scoring;
- retrieval diagnostics exclude raw queries and claims;
- the fixed corpus reaches at least 80% Top-5 recall;
- source inspection confirms Codex CLI remains the sole reasoning gateway and external actions remain impossible.

`npm run v033:evaluate` prints the deterministic corpus result. It consumes no model usage.
