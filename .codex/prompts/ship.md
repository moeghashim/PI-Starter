# /ship

Purpose: ship solo changes cleanly through the no-mistakes push gate.

Workflow:
1. Confirm whether the target is an app deploy, a package release, or both.
2. Confirm the working tree is clean, the work is committed, and the current branch is a feature branch.
3. If the change affects behavior, review it against `agent/skills/addyosmani/code-review-and-quality`.
4. If the change affects trust boundaries, auth, input handling, or third-party integrations, review it against `agent/skills/addyosmani/security-and-hardening`.
5. If the change alters repo conventions, interfaces, or architecture, record or update an ADR under `docs/adrs/` using `docs/architecture-decisions.md`.
6. Push committed work with `git push no-mistakes`. Do not push directly to `origin`.
7. If the work is not committed yet, use bare `/no-mistakes` to let the gate commit and validate it, or `/no-mistakes <task>` to have the agent do-and-gate a task.
8. If shipping the app, select `docs/deploying-to-vercel.md` or `docs/deploying-to-cloudflare.md` for the chosen provider. Cloudflare changes must pass the `Cloudflare build` CI check.
9. If shipping the app, check whether the diff includes schema, migration, seed, ORM, database client, or database environment changes; if so, run or document the required database deploy step.
10. If shipping a package, first switch to clean `main` matching the fetched `origin/main`, then run `npm run release:<patch|minor|major> -- --learning "..."`. The bumped tree must pass all release checks before commits and tags are created. Pass `--publish` only when intentionally publishing packages, and `--push` only when intentionally pushing `main` and the release tag atomically. Do not bypass branch protection if that push is rejected.
11. Summarize what shipped, the no-mistakes gate status, database deploy status when relevant, and any manual follow-up.
