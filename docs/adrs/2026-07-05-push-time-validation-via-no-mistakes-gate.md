---
summary: "Route feature branch pushes through the no-mistakes validation gate"
read_when:
  - Shipping feature branches from this starter.
  - Re-evaluating push-time validation, PR creation, or progress-log requirements.
---

# Push-Time Validation Via No-Mistakes Gate

## Status

Accepted

## Context

PI Starter already treats GitHub Actions required checks as the merge backstop, but local push and PR creation still depended on each agent remembering the same validation sequence. The starter also requires human or agent-initiated commits to append a `progress.md` learning entry through `commit:with-progress`.

## Decision

All feature branch pushes route through the `no-mistakes` proxy remote with `git push no-mistakes`. The gate runs pinned pipeline commands from `.no-mistakes.yaml`, forwards branches only after validation passes, and opens the PR.

Gate auto-fix commits are exempt from the progress-log requirement. The progress log records human and agent-initiated learnings; mechanical gate fixes stay outside that signal.

## Consequences

`/ship` delegates final validation and PR creation to the gate. GitHub Actions required checks remain the branch-protection source of truth after the PR opens. The gate can watch CI and apply safe mechanical fixes before forwarding clean work.

Agents must not push feature branches directly to `origin`. If the gate cannot run, shipping is blocked until `no-mistakes` is initialized for the repo or the maintainer explicitly chooses another path.

## Alternatives Considered

- Manual local validation plus direct push to `origin`: rejected because it keeps the highest-risk step dependent on agent memory and local discipline.
- GitHub Actions only: retained as the merge backstop, but not enough to prevent noisy PRs or automate safe pre-PR fixes.
