# /landpr

Purpose: land one PR cleanly with explicit validation.

Workflow:
1. Confirm PR is mergeable and not draft.
2. Review diff and comments for unresolved issues.
3. Ensure local branch is up to date with base branch.
4. Run full validation (`npm run check`, `npm test`, `npm run agent:check`).
5. Merge with repository-preferred strategy.
6. Verify final PR state is `MERGED` and sync local `main`.
