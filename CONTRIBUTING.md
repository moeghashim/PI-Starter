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
- For release commands, pass `--learning`, for example: `npm run release:patch -- --learning "What we learned from this release."`.
- Release scripts skip `npm publish` by default in this starter; add `--publish` only when you intentionally want to publish packages.
- In `apps/web`, do not import `useEffect` directly; use render-time derivation, event handlers, framework data loading, or `useMountEffect`.
- Keep commit messages as clear summaries (do not use prompt-only commit subjects).
- Push feature branches with `git push no-mistakes`; do not push directly to `origin`. The gate validates the branch and opens the pull request.
- Start the gate daemon with Node 22 and npm on its `PATH`, using your preferred version manager or a standalone installation. The commands do not source nvm or a shell profile; `npm run check` still rejects an unsupported Node version.
- The pre-commit hook validates the working tree without re-staging files. For partial commits, review `git diff --cached` as well: unstaged changes can affect validation even though they are excluded from the commit.
- Releases require clean `main` matching the fetched `origin/main`. Version bumps preserve locked dependencies. Release validation runs on the bumped tree before commits and tags are created.
- After changing bindings or `vars` in `apps/web/wrangler.jsonc`, run `npm run typegen:cloudflare` and commit the regenerated `apps/web/cloudflare-env.d.ts`; `npm test` fails when the committed file drifts.
- For substantial agent-generated changes, include a `Repro-Prompt:` commit trailer.
- Vendored Vercel skills are pinned through `agent/skills-manifest.json`; use `npm run skills:sync` and `npm run skills:verify-sync` when updating them.

## Dependency Overrides
The root `package.json` `overrides` block pins transitive dependencies for security reasons. Keep each entry only while the reason still applies, and re-check with `npm audit` when upgrading the parent package.
- Next.js 16.4.1 declares `sharp@^0.35.5` and `postcss@8.5.23`, so the earlier Next.js overrides are no longer necessary. Keep the lockfile current and run `npm audit` when updating Next.js or Wrangler rather than pinning an older security override indefinitely.
- `@node-minify/core` -> `glob@12.0.0`: the OpenNext AWS adapter pulls `@node-minify/core`, which pins the deprecated `glob@9.3.5` line. The override dedupes onto the maintained root `glob` release; `npm ls glob` must report a single resolved version.
