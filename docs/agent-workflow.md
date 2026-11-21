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
2. If the task touches React, Next.js, UI review, interaction patterns, test strategy, review rigor, security, architecture review, refactoring, ADR decisions, or memory-leak debugging, read `docs/agent-skills.md`.
3. Review recent entries in `progress.md` and capture relevant learnings for the task.
4. Run `npm run docs:list` to confirm docs metadata is valid.
5. Use the `/pickup` skill to rehydrate context.

## Execute

1. Use the `/fix` skill for bugs and regressions.
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

1. Use `/ship` for the solo finalization flow.
2. Push committed feature branches with `git push no-mistakes`; do not push directly to `origin`.
3. For app deploys, choose `docs/deploying-to-vercel.md` or `docs/deploying-to-cloudflare.md`. Let the no-mistakes gate open the PR and the selected provider deploy after the protected branch merges. Cloudflare changes must pass `Cloudflare build` in CI.
4. For package releases, follow the release flow in `README.md`: prepare with `npm run release:<patch|minor|major> -- --learning "..."`, push the `release/vX.Y.Z` branch with `git push no-mistakes`, and after the pull request merges run `npm run release:tag`. The decision record is `docs/adrs/2026-10-18-release-through-pull-requests.md`.

### Optional batch workflow

Choose one workflow for the project. The normal push path remains available. To use batching, land the gate config on main first. Enable merge commits and keep the required CI checks for main. Give one operator a clone with `gh` and no-mistakes set up. Use linked worktrees from that clone for all batch gate commands. Use the batch commands for all gate starts and merges in this mode. A second clone or a plain push would bypass the lock.

1. Run `npm run batch -- target`. The command creates the batch ref at the current main commit if needed. This bootstrap creates a ref to an existing commit. It sends no new commits.
2. Commit the task and run `npm run batch -- task <intent-file>`. Keep reviewing and resolving AXI decisions until the run ends. Run `npm run batch -- resume` to clear the reservation and record the passes for the exact head. Run `npm run batch -- merge <task-PR>`. If the base advanced after review, rerun the task gate against the current batch before merging.
3. Once the batch has no outstanding task PRs, fetch its tip and check out that branch. Merge main into it if main moved. Run `npm run batch -- publish <intent-file>`. GitHub opens the full CI run when the gate publishes the batch PR. Configure a root `test:e2e` script when the project has end-to-end tests.
4. While that PR is open, new task branches go into the next batch. When required checks and review pass, run `npm run batch -- merge <batch-PR>`.
5. If a batch fails, branch from its latest remote head and use `npm run batch -- repair <intent-file>`. Merge the fix PR into the failed batch. GitHub starts CI for the new head. If the failure happened before publication, run the batch gate again after merging the fix. On an open batch PR, rerun the batch gate on the updated head to record a new receipt before merging to main. Keep the existing commits, including when bringing main into a batch. If full-gate validation fails, stop that run and resolve your AXI custody state before creating the fix branch. Approve neither a failed check nor a gate repair that edits the batch checkout.

Batch gates use the configured agent profile. The installed AXI help documents `--base-branch` and comma-separated `--skip`. The optional `--model` and `--effort` flags apply to Pi-only runs and require a complete profile.

If the runner stops while a gate is active, inspect `no-mistakes axi status` from that branch and resume the existing run. Follow any AXI custody recovery instructions. If the process was killed and left the mutex directory behind, verify that no batch command is still running before removing only `pi-starter-batch.lock` from the local bare gate. Keep the reservation file in place until the run reaches a terminal state.

### PR readiness and review feedback

Run `npm run pr:ready -- <number> [owner/repo]` after the gate opens the PR and before reporting it ready or merging it. The command reads classic branch protection and branch rulesets, requires successful checks on the current head, checks review threads and requests for changes, and rechecks both head and base commits. Exit 0 means ready at the time of inspection, 1 means blockers remain, and 2 means inspection failed. Missing checks stay pending. A requirement bound to a GitHub App passes only on a successful check run from that app; a commit status satisfies only requirements with no app binding. Run it again after any push, repair, or base update.

The command reports the PR URL, inspected head, required-check results, and blockers as JSON. GitHub must report a clean merge state. A new commit invalidates earlier evidence. Resolve missing requirements or API errors before reporting readiness.

Read human and configured review-bot feedback, including top-level PR comments, before handoff. Confirm findings against the current source and latest push. Send real fixes through the active no-mistakes run. For a false positive, explain the evidence in a reply and resolve the thread when authorized by the user's request. Outstanding requests for changes need the reviewer's approval or an authorized dismissal. Keep repairs within the requested scope.

The no-mistakes daemon owns validation, repairs, pushes, and monitoring during an active run. Use its gate responses for fixes. Run the readiness command as a final inspection when the daemon reports green. On a blocked result, inspect the cause and continue through the existing monitor. Repeat inspection when a relevant event arrives. Merge only when the user has authorized it and readiness succeeds again.

Require conversation resolution in GitHub branch protection so unresolved review threads also block the merge on GitHub.

## Handoff

1. Use `/handoff` when another agent or engineer really does need to continue the work.
2. Include exact commands for any remaining validation or release/deploy follow-up.
