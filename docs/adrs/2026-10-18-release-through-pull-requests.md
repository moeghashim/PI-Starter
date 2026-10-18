---
summary: "Prepare package releases as pull requests and tag main only after the release merges"
read_when:
  - Preparing, tagging, or publishing a package release.
  - Re-evaluating how releases interact with branch protection, CI, or the no-mistakes gate.
---

# Release Through Pull Requests

## Status

Accepted

## Context

`npm run release:*` used to bump versions, commit, and tag directly on `main`, and `--push` pushed `main` plus the tag. Branch protection requires `Required checks` and `DCO`, so that push only worked because repository admins can bypass protection. Release commits therefore skipped the CI and DCO checks that every other change must pass, and they contradicted the rule that branches go through `git push no-mistakes`.

## Decision

Releases become ordinary pull requests.

- `npm run release:<patch|minor|major> -- --learning "..."` runs on clean `main` matching `origin/main`. It bumps versions, refuses a version whose tag already exists, starts a new changelog section, appends a `progress.md` entry, validates the bumped tree, and makes one signed `chore(release): vX.Y.Z` commit on a `release/vX.Y.Z` branch.
- The branch is pushed with `git push no-mistakes` and merges after `Required checks` and `DCO` pass.
- After the merge, `npm run release:tag` on up-to-date `main` confirms the merged release commit exists, creates an annotated tag, and pushes only the tag. `-- --publish` additionally publishes the non-private packages.

## Consequences

Every commit on `main`, including releases, has passed CI and the DCO check. Releasing takes two commands instead of one, separated by a pull request merge. Tags point at commits that exist on protected `main`.

`release:tag` runs locally, so publishing still uses the maintainer's npm credentials. If a release preparation fails validation, the `release/vX.Y.Z` branch is left with uncommitted changes to fix or discard.

## Alternatives Considered

- Keep direct pushes to `main`: rejected because releases were the only path that skipped CI and DCO, and it breaks if admins are ever included in branch protection.
- Tag and publish from a CI workflow after merge: more robust and enables npm provenance through trusted publishing, but adds machinery a solo starter does not need yet. Revisit if packages are published regularly.
