---
summary: "Use PStack for development, TStack for PR handoff, and required GitHub checks for merge"
read_when:
  - Choosing the feature, release, or deployment workflow.
  - Updating agent skills for verification or PR review.
---

# Use PStack and TStack with GitHub Pull Requests

## Status

Accepted. Supersedes [Push-Time Validation Via No-Mistakes Gate](2026-07-05-push-time-validation-via-no-mistakes-gate.md).

## Context

The previous push proxy ran AI review and checks before publication. GitHub ran CI again once the PR opened. Concurrent proxy runs could race when updating Git refs.

## Decision

Use the portable PStack guidance during development and TStack's full-stop workflow for proof, review, and PR handoff. Pin both subsets through the existing skill manifests. Keep host-specific instructions in a local skill and the repository workflow.

Push feature branches to origin and open a GitHub PR. Keep required CI, DCO, and conversation resolution as GitHub merge controls. Warn above 1,500 authored lines per PR.

## Consequences

A feature branch can reach GitHub before review completes. A project that needs mandatory independent review must enforce that in GitHub. The starter workflow reports when cross-model review is unavailable. GitHub runs full CI per PR.

The repository no longer depends on the proxy's isolated worktree, automatic repairs, or branch custody recovery. The portable PStack skill can use host tools. Cursor automations and Cursor cloud agent controls need a Cursor integration.
