---
summary: "Codex-first workflow for pickup, execution, handoff, and guardrail checks"
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
5. Use `/pickup` from `.codex/prompts/pickup.md` to rehydrate context.

## Execute

1. Use `/fix` from `.codex/prompts/fix.md` for bugs and regressions.
2. Use `/build-feature` from `.codex/prompts/build-feature.md` for net-new features, starting with the smallest user-visible vertical slice.
3. Validate that first slice immediately and stop for feedback before expanding to the next slice.
4. Keep edits scoped and explicit.
5. Prefer `npm run commit:with-progress -- "<message>" --learning "<learning>" -- "<path>" ...` for agent-requested commits so `progress.md` is appended in the same commit.
6. Use `npm run commit:selective -- "<message>" "<path>" ...` when a commit is intentionally not part of the learning-log flow.
7. Keep public package APIs re-exported through `src/index.ts`.

## Validate

1. Run `npm run check` for read-only code quality validation. Use `npm run fix` explicitly to apply fixes, then review the diff.
2. Run `npm test` for test coverage.
3. Run `npm run fallow:audit` to reject newly introduced dead code, duplication, and complexity findings relative to `origin/main`.
4. Run `npm run agent:check` before ship or handoff to validate docs, AGENTS structure, and vendored sync across all skill packs.

## Ship

1. Use `/ship` for the solo finalization flow.
2. Push committed feature branches with `git push no-mistakes`; do not push directly to `origin`.
3. For app deploys, choose `docs/deploying-to-vercel.md` or `docs/deploying-to-cloudflare.md`. Let the no-mistakes gate open the PR and the selected provider deploy after the protected branch merges. Cloudflare changes must pass `Cloudflare build` in CI.
4. For package releases, start on clean `main` matching the fetched `origin/main`. Release commands preserve the lockfile and validate the bumped tree with build, check, tests, agent checks, and Fallow before committing and tagging. Publishing requires `--publish`; pushing requires `--push`, which atomically pushes the release branch and tag. Protected-branch rejection leaves the local release available for review; do not bypass protection.

## Handoff

1. Use `/handoff` when another agent or engineer really does need to continue the work.
2. Include exact commands for any remaining validation or release/deploy follow-up.
