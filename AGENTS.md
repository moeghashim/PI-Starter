# Development Rules

## Layout
- `apps/web`: TanStack Start app on Vite. Nitro builds the default server, and Cloudflare’s Vite plugin builds the Worker.
- `packages/core`: publishable library; public API re-exported from `src/index.ts`.
- `scripts/`: repo automation; regression tests live in `scripts/test/`.
- `agent/`: manifests that pin vendored skills to upstream commits.
- `.agents/skills/`: every skill, vendored and local; `.claude/skills` links here.
- `docs/`: workflow, skill, and deploy docs; decisions live in `docs/adrs/`.

## Code Quality
- No `any` types unless absolutely necessary.
- Check `node_modules` for external API type definitions instead of guessing.
- Never use inline or dynamic imports, including `await import("./foo.js")` and `import("pkg").Type` in type positions; use standard top-level imports.
- Never remove functionality to fix type errors from outdated dependencies; upgrade dependencies instead.
- Always ask before removing functionality that appears intentional.

## Style
- ESM TypeScript.
- Relative imports must include `.js` extension.
- Keep public APIs in `src/index.ts` (re-export), keep internals in separate modules.
- No emojis in commit messages or code comments.

## React App Rules
- Use the React and UI guidance in the vendored Vercel skills. Do not add Next.js imports such as `next/image` or `next/link`, App Router conventions, or the `"use client"` directive.
- In `apps/web`, do not import `useEffect` directly.
- Prefer render-time derivation, event handlers, and framework data loading over effects.
- `useMountEffect` is the only allowed mount-only escape hatch for synchronizing with an external system.

## Commands
- Dev server: `pnpm run dev`. App tests: `pnpm run test:app`. Repo tests: `pnpm run test:repo`. Full tests: `pnpm test`. Worker build: `pnpm run build:cloudflare`.
- Fork initialization: `pnpm run init:project -- --name <slug>`.
- After code changes (not docs changes): `pnpm run check`. It never applies fixes; run `pnpm run fix` explicitly, then review its changes.
- Before handoff or ship, run `pnpm run fallow:audit` to block newly introduced dead code, duplication, and complexity findings against `origin/main`.
- Fix all errors, warnings, and infos before committing.
- After changing bindings or `vars` in `apps/web/wrangler.jsonc`, run `pnpm run typegen:cloudflare` and commit the regenerated `apps/web/cloudflare-env.d.ts`.
- Releases: `pnpm run release:<patch|minor|major> -- --learning "..."` on clean `main`, open a pull request from the `release/vX.Y.Z` branch, then run `pnpm run release:tag` after it merges.

## Toolchain
- Use the Node major in `.nvmrc` and `pnpm`; `pnpm run check` fails on any other Node version.
- Use TypeScript 7 in all workspaces with incremental build info in `.cache/tsbuildinfo/`. Commit `apps/web/src/routeTree.gen.ts` after route changes. Vite regenerates it during development and builds. Keep Node ambient types in the tooling TypeScript project.
- Keep `node_modules` machine-local. After moving between `darwin-x64`, `darwin-arm64`, Linux, or Rosetta/native modes, run `pnpm install` or `pnpm run reinstall:clean` before using native-tooling commands.

## Database Deployments
- Treat app and database deployment as separate release surfaces. Before shipping an app, check the diff for schema, migration, ORM configuration, seed data, database client, or database environment changes.
- If any are present, run the project's database deploy or migration command before reporting the app as shipped. If it cannot be run, report it as a blocking or pending release step with the exact command or owner needed.

## Agent Workflow
- Agent workflow docs live in `docs/agent-workflow.md`, skill guidance in `docs/agent-skills.md`, and command index in `docs/commands.md`.
- At task start, review recent entries in `progress.md` to understand prior learnings.
- Treat `progress.md` as part of the starter contract for forks; keep it tracked, preserve the append-only history, and continue the log in derived repos.
- Keep `CLAUDE.md` as a tracked symlink to `AGENTS.md`; `AGENTS.md` remains the canonical source of agent instructions.
- Skills live in `.agents/skills/<name>/SKILL.md`; keep `.claude/skills` as a tracked symlink to `../.agents/skills`. Vendored skill directories are owned by their manifest: change them through the sync commands, never by hand.
- Run `pnpm run docs:list` whenever docs are added or updated.
- Run `pnpm run agent:check` before handoff to validate docs front matter, AGENTS structure, and vendored file integrity. It runs offline by hashing vendored files against their manifests.
- After editing a skill manifest, run `pnpm run skills:sync` and then `pnpm run agent:verify-upstream` to confirm the pinned hashes match upstream. CI runs the upstream check on skill/manifest changes, pushes to `main`, and weekly schedules.
- Use `pnpm run commit:selective -- "type(scope): summary" "path/one" "path/two"` for path-scoped commits.
- For agent-requested commits, use `pnpm run commit:with-progress -- "type(scope): summary" --learning "what was learned" -- "path/one" "path/two"` so `progress.md` is appended in the same commit.
- The `memory-leak-debugging` skill requires the `chrome-devtools` MCP server from `.mcp.json`, started with `--memoryDebugging`, for both heap-snapshot capture and analysis. Never read raw `.heapsnapshot` files directly.

## Git
- Never commit unless explicitly requested.
- Use `/pstack-work` for development and verification. Use TStack `full-stop` for PR review and handoff. Push feature branches to `origin` and open a GitHub pull request. Never push to `main` directly. Run `pnpm run pr:ready` with the PR number before reporting readiness. Merge only with explicit authorization.
- Keep commit subjects as normal, human-readable summaries (for example `feat(core): add retry guard`).
- Every commit must carry a `Signed-off-by:` trailer matching the author for the DCO check; keep `DCO` required in branch protection so unsigned PRs cannot merge. Use `git commit -s`; the Husky `prepare-commit-msg` hook adds it automatically where hooks are installed.
- Do not replace commit messages with prompt text.
- `progress.md` is append-only: only add new entries at the end; never edit prior entries.
- For substantial agent-generated changes, add a `Repro-Prompt:` trailer in the commit message body.
