# Contributing

## Local Development
- Run doctor: `npm run doctor`
- Install: `npm install`
- Check: `npm run check`
- Apply formatting/lint fixes explicitly: `npm run fix`, then review the diff.
- Test: `npm test` (runs the root regression tests in `scripts/test/` before workspace tests)
- Reinstall when moving between `darwin-x64`, `darwin-arm64`, Linux, or Rosetta/native Node: `npm run reinstall:clean`

## Rules
- Keep changes small and cohesive.
- Avoid `any` unless absolutely needed.
- No inline or dynamic imports.
- Relative imports include `.js` extension.
- `progress.md` is append-only; only add new entries at the end.
- Forks should keep `progress.md` tracked and continue appending learnings so the repo retains local project memory after forking.
- For agent-requested commits, use `npm run commit:with-progress -- "<message>" --learning "<learning>" -- "<path>" ...`.
- Prepare releases with `npm run release:patch -- --learning "What we learned from this release."`, open a pull request from the `release/vX.Y.Z` branch, and after it merges run `npm run release:tag` from any clean checkout.
- `release:tag` skips `npm publish` by default; add `-- --publish` only when you intentionally want to publish packages.
- In `apps/web`, do not import `useEffect` directly; use render-time derivation, event handlers, framework data loading, or `useMountEffect`.
- Keep commit messages as clear summaries (do not use prompt-only commit subjects).
- Validate changes locally, push the feature branch to `origin`, and open a pull request. See `docs/agent-workflow.md` for review and handoff.
- The pre-commit hook validates the working tree without re-staging files. For partial commits, review `git diff --cached` as well: unstaged changes can affect validation even though they are excluded from the commit.
- Release preparation requires clean `main` matching the fetched `origin/main`. Version bumps preserve locked dependencies, and validation runs on the bumped tree before the release commit is created.
- After changing bindings or `vars` in `apps/web/wrangler.jsonc`, run `npm run typegen:cloudflare` and commit the regenerated `apps/web/cloudflare-env.d.ts`; `npm test` fails when the committed file drifts.
- For substantial agent-generated changes, include a `Repro-Prompt:` commit trailer.
- Skills live in `.agents/skills/`; `.claude/skills` is a symlink to it. Vendored packs are pinned through the `agent/skills-manifest*.json` files; use `npm run skills:sync` and `npm run agent:verify-upstream` when updating them, and never hand-edit a vendored skill directory.

## Dependency Overrides
The root `package.json` `overrides` block pins transitive dependencies for security reasons. Keep each entry only while the reason still applies, and re-check with `npm audit` when upgrading the parent package.
