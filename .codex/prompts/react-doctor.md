# /react-doctor

Purpose: scan React code with React Doctor, triage the findings, and keep intentional local exceptions narrow.

Workflow:
1. Run `npm run react:doctor`.
2. Treat errors, security findings, and changed-code regressions as the first priority.
3. For dependency security findings, prefer upgrading to a patched release over suppressing the diagnostic.
4. For diagnostics that conflict with an intentional starter rule, explain the local invariant and use the narrowest `doctor.config.ts` override.
5. After fixes, run `npm run react:doctor:changed`, `npm run check`, and `npm run agent:check`.
6. Summarize findings fixed, findings intentionally suppressed, and any remaining advisory dependency risk.
