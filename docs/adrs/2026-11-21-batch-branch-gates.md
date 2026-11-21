---
summary: "Review task branches in a light gate and run required CI on one batch PR at a time"
read_when:
  - Choosing or changing the project push and merge workflow.
---

# Batch Branch Gates

## Status

Accepted

## Context

Large changes take longer to review, and parallel gate runs can try to update the same Git tracking ref. Task branches need prompt review and a way to pass all integration checks before they reach main.

## Decision

Keep the existing one-PR-per-branch path. A project can choose the batch commands instead. One operator uses one initialized clone and its worktrees for all batch commands. The commands share an exclusive lock at the gate repository. A reservation survives a CLI timeout or a pause for review. It is released after the daemon reports a terminal result.

Task PRs target a numbered batch branch. Their gate keeps Review and runs a light Lint command on the reviewed diff. It skips the separate Test, Document, and CI steps. The light command checks PR size, lints and builds the changed workspaces, and runs their unit tests. Root build or tooling changes expand the scope.

The batch gate keeps Review, Test, Document and Lint. It skips Rebase to preserve commits already integrated. It skips the daemon's CI monitor because that monitor can rebase or push repairs to a published branch. GitHub runs the full CI workflow for the batch PR. The batch merge command requires the current head to pass the repository's PR readiness checks.

When a batch PR is open, new tasks go into the next batch. Fix a failed batch by merging a reviewed fix branch into that same batch. Retain the original commits through merge commits. The batch commands ask GitHub to merge by the exact validated head.

Warn at more than 1,500 additions and deletions. Exclude vendored, lock, and generated files. Measure the task diff against its target branch. Skip the warning on the aggregate PR.

## Consequences

The batch workflow serializes gate runs, even while the daemon waits at a review decision. Work on task branches can continue in parallel. GitHub CI can run while the operator admits work to the next batch. Keep the batch refs and use merge commits in repository settings.

## Alternatives Considered

Separate daemon runs on the same repository can race on tracking refs. A lock around only the CLI process would open that race again whenever the CLI returns before its daemon. The persistent reservation covers that pause.
