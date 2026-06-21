# /ship

Purpose: ship solo changes cleanly without a PR workflow.

Workflow:
1. Confirm whether the target is an app deploy, a package release, or both.
2. Run full validation (`npm run check`, `npm test`, `npm run agent:check`).
3. If the change affects behavior, review it against `agent/skills/addyosmani/code-review-and-quality`.
4. If the change affects trust boundaries, auth, input handling, or third-party integrations, review it against `agent/skills/addyosmani/security-and-hardening`.
5. If the change alters repo conventions, interfaces, or architecture, record or update an ADR under `docs/adrs/` using `docs/architecture-decisions.md`.
6. If shipping the app, treat `docs/deploying-to-vercel.md` as the starter's canonical deployment path.
7. If shipping the app, check whether the diff includes schema, migration, seed, ORM, database client, or database environment changes; if so, run or document the required database deploy step.
8. If shipping React or Next.js app changes, run `npm run react:doctor:changed`.
9. If shipping a package, run the correct `npm run release:<patch|minor|major> -- --learning "..."` command. Pass `--publish` only when intentionally publishing packages, and pass `--push` only when intentionally pushing `main` and the release tag.
10. Summarize what shipped, which validations ran, database deploy status when relevant, and any manual follow-up.
