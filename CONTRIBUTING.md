# Contributing

## Local Development
- Run doctor: `npm run doctor`
- Install: `npm install`
- Check: `npm run check`
- Apply formatting/lint fixes explicitly: `npm run fix`, then review the diff.
- Test: `npm test`
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
- The pre-commit hook validates the working tree without re-staging files. For partial commits, review `git diff --cached` as well: unstaged changes can affect validation even though they are excluded from the commit.
- Releases require clean `main` matching the fetched `origin/main`. Version bumps preserve locked dependencies. Release validation runs on the bumped tree before commits and tags are created.
- For substantial agent-generated changes, include a `Repro-Prompt:` commit trailer.
- Vendored Vercel skills are pinned through `agent/skills-manifest.json`; use `npm run skills:sync` and `npm run skills:verify-sync` when updating them.

## Dependency Overrides
The root `package.json` `overrides` block pins transitive dependencies for security reasons. Keep each entry only while the reason still applies, and re-check with `npm audit` when upgrading the parent package.
- `next` -> `sharp@0.35.3`: Next.js 16.2 declares `sharp@^0.34.5`, and every `sharp` release below 0.35.0 inherits libvips vulnerabilities (GHSA-f88m-g3jw-g9cj). Next.js only uses the `concurrency`, `timeout`, `rotate`, `resize`, and format encoder APIs, which are unchanged in 0.35, and `optimizeImage` was verified to produce WebP, AVIF, PNG, and JPEG output on 0.35.3. Drop the override once Next.js declares a `sharp` range at or above 0.35.0.
- `next` -> `postcss@8.5.23`: Next.js 16.2 pins `postcss@8.4.31`, which is affected by GHSA-qx2v-qp2m-jg93, GHSA-6g55-p6wh-862q, GHSA-fxqj-rqcc-2cmp, and GHSA-r28c-9q8g-f849.
- `@node-minify/core` -> `glob@12.0.0`: the OpenNext AWS adapter pulls `@node-minify/core`, which pins the deprecated `glob@9.3.5` line. The override dedupes onto the maintained root `glob` release; `npm ls glob` must report a single resolved version.
