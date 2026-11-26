---
summary: "Skill-driven workflow for pickup, execution, handoff, and guardrail checks"
read_when:
  - Starting work in a fresh session.
  - Handing off work to another agent or engineer.
  - Preparing to ship a solo app deploy or package release.
---

# Agent Workflow

## Start

1. Read `AGENTS.md` and the relevant docs in this folder. `CLAUDE.md` is a compatibility symlink, not a separate instruction source.
2. If the task touches React, UI review, interaction patterns, test strategy, review rigor, security, architecture review, refactoring, ADR decisions, or memory-leak debugging, read `docs/agent-skills.md`.
3. Review recent entries in `progress.md` and capture relevant learnings for the task.
4. Run `npm run docs:list` to confirm docs metadata is valid.
5. Use the `/pickup` skill to rehydrate context.

## Execute

1. Use `/pstack-work` to choose the development and verification steps for this task. Use `/fix` for bugs and regressions.
2. Use the `/build-feature` skill for net-new features, starting with the smallest user-visible vertical slice.
3. Validate that first slice immediately and stop for feedback before expanding to the next slice.
4. Keep edits scoped and explicit.
5. Prefer `npm run commit:with-progress -- "<message>" --learning "<learning>" -- "<path>" ...` for agent-requested commits so `progress.md` is appended in the same commit.
6. Use `npm run commit:selective -- "<message>" "<path>" ...` when a commit is intentionally not part of the learning-log flow.
7. Keep public package APIs re-exported through `src/index.ts`.

## Validate

1. Run `npm run check` for read-only code quality validation. Use `npm run fix` explicitly to apply fixes, then review the diff.
2. Run `npm test` for test coverage.
3. Run `npm run fallow:audit` to reject newly introduced dead code, duplication, and complexity findings relative to `origin/main`.
4. Run `npm run agent:check` before ship or handoff to validate docs, AGENTS structure, and vendored file integrity across all skill packs. It runs offline; CI also runs `npm run agent:verify-upstream` to confirm manifests still match their pinned upstream commits.

## Ship

1. Use `/ship` for solo app deployment or package release. Authenticate GitHub CLI and use the Node major from `.nvmrc`.
2. Use TStack `full-stop` for proof, independent review, PR publication, and monitoring when authorized. Repository rules control when you may commit, push, rebase, delegate, use a tool, or merge. Use the workflow steps within those limits. Run `python3 .agents/skills/babysit-pr/scripts/pr-wait <number>` from the repo root, or use GitHub CLI to inspect checks and comments. The watcher reports events. Use the PR readiness command for the final decision. Use the watcher’s `--until green` mode when the repo has no Greptile or Macroscope.
3. If the independent reviewer or model is unavailable, report that and ask for review on the PR. A self-review does not fill that gap. As part of this workflow, push the feature branch to `origin` and open the PR with `gh pr create` if one does not exist. Leave the PR open for handoff.
4. Run `npm run pr:size -- origin/main` for a local warning. GitHub CI posts the same warning for a PR above 1,500 added and removed authored lines. Vendored, lock, and generated files are excluded.
5. For app deploys, follow `docs/deploying-to-vercel.md`, `docs/deploying-to-cloudflare.md`, or `docs/deploying-to-other-hosts.md`. The `Web builds` job checks both Nitro and Cloudflare. For package releases, prepare the release branch as described in `README.md`, open a PR, then run `npm run release:tag` after merge.

### PR readiness and review feedback

Run `npm run pr:ready -- <number> [owner/repo]` after opening the PR and before reporting it ready or merging it. The command reads classic branch protection and branch rulesets, requires successful checks on the current head, checks review threads and requests for changes, and rechecks both head and base commits. Exit 0 means ready at the time of inspection, 1 means blockers remain, and 2 means inspection failed. Missing checks stay pending. A requirement bound to a GitHub App passes only on a successful check run from that app; a commit status satisfies only requirements with no app binding. Run it again after any push, repair, or base update.

The command reports the PR URL, inspected head, required-check results, and blockers as JSON. GitHub must report a clean merge state. A new commit invalidates earlier evidence. Resolve missing requirements or API errors before reporting readiness.

Read human and configured review-bot feedback, including top-level PR comments, before handoff. Confirm findings against the current source and latest push. Commit and push fixes to the feature branch, then inspect the new head. For a false positive, explain the evidence in a reply and resolve the thread when authorized by the user's request. Outstanding requests for changes need the reviewer's approval or an authorized dismissal. Keep repairs within the requested scope.

Use the readiness command as a final inspection when GitHub checks pass. On a blocked result, inspect the cause and repeat the check on the current head after a relevant change. Merge only when the user has authorized it and readiness succeeds again.

Require conversation resolution in GitHub branch protection so unresolved review threads also block the merge on GitHub.

## Handoff

1. Use `/handoff` when another agent or engineer really does need to continue the work.
2. Include exact commands for any remaining validation or release/deploy follow-up.
