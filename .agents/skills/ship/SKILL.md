---
name: ship
description: Prepare committed solo changes for a GitHub pull request and follow through on an authorized app deploy or package release. Run only when the user asks to ship.
disable-model-invocation: true
---

# /ship

1. Identify the target, app deployment, package release, or both. Confirm the feature branch contains the intended commits and has a clean working tree.
2. Follow the validation and shipping steps in `docs/agent-workflow.md`. Use TStack `full-stop` under the repository authorization rules. Apply `security-and-hardening` when the change affects trust boundaries or integrations.
3. Run `npm run pr:ready -- <number> [owner/repo]` against the final head. Report proof, review, and remaining blockers. Merge only with explicit authorization.
4. After an authorized merge, follow the selected deployment doc. For app changes, check for schema, migration, seed, ORM, database client, and database environment changes before rollout. Run any required database deploy step before reporting the app as shipped.
5. For a package release, use the release commands in `README.md`. Run `npm run release:tag` after the release PR merges. Use `--publish` only when authorized.
