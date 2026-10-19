# Development Rules

## Layout
- `apps/web`: Next.js app, deployable to Vercel or to Cloudflare Workers through OpenNext.
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
- In `apps/web`, do not import `useEffect` directly.
- Prefer render-time derivation, event handlers, and framework data loading over effects.
- `useMountEffect` is the only allowed mount-only escape hatch for synchronizing with an external system.

## Commands
- Dev server: `npm run dev -w @pi-starter/web`. Tests: `npm test`. Worker build: `npm run build:cloudflare`.
- After code changes (not docs changes): `npm run check`. It never applies fixes; run `npm run fix` explicitly, then review its changes.
- Before handoff or ship, run `npm run fallow:audit` to block newly introduced dead code, duplication, and complexity findings against `origin/main`.
- Fix all errors, warnings, and infos before committing.
- After changing bindings or `vars` in `apps/web/wrangler.jsonc`, run `npm run typegen:cloudflare` and commit the regenerated `apps/web/cloudflare-env.d.ts`.
- Releases: `npm run release:<patch|minor|major> -- --learning "..."` on clean `main`, push the `release/vX.Y.Z` branch through the gate, then run `npm run release:tag` after it merges.

## Toolchain
- Use the Node major in `.nvmrc`; `npm run check` fails on any other version.
- The root and `packages/core` compile with TypeScript 7. `apps/web` stays on TypeScript 5.9 until Next.js supports 7, so do not bump its `typescript`.
- Keep `node_modules` machine-local. After moving between `darwin-x64`, `darwin-arm64`, Linux, or Rosetta/native modes, run `npm install` or `npm run reinstall:clean` before using native-tooling commands.

## Database Deployments
- Treat app and database deployment as separate release surfaces. Before shipping an app, check the diff for schema, migration, ORM configuration, seed data, database client, or database environment changes.
- If any are present, run the project's database deploy or migration command before reporting the app as shipped. If it cannot be run, report it as a blocking or pending release step with the exact command or owner needed.

## Agent Workflow
- Agent workflow docs live in `docs/agent-workflow.md`, skill guidance in `docs/agent-skills.md`, and command index in `docs/commands.md`.
- At task start, review recent entries in `progress.md` to understand prior learnings.
- Treat `progress.md` as part of the starter contract for forks; keep it tracked, preserve the append-only history, and continue the log in derived repos.
- Keep `CLAUDE.md` as a tracked symlink to `AGENTS.md`; `AGENTS.md` remains the canonical source of agent instructions.
- Skills live in `.agents/skills/<name>/SKILL.md`; keep `.claude/skills` as a tracked symlink to `../.agents/skills`. Vendored skill directories are owned by their manifest: change them through the sync commands, never by hand.
- Run `npm run docs:list` whenever docs are added or updated.
- Run `npm run agent:check` before handoff to validate docs front matter, AGENTS structure, and vendored file integrity. It runs offline by hashing vendored files against their manifests.
- After editing a skill manifest, run `npm run skills:sync` and then `npm run agent:verify-upstream` to confirm the pinned hashes match upstream. CI runs the upstream check on every push.
- Use `npm run commit:selective -- "type(scope): summary" "path/one" "path/two"` for path-scoped commits.
- For agent-requested commits, use `npm run commit:with-progress -- "type(scope): summary" --learning "what was learned" -- "path/one" "path/two"` so `progress.md` is appended in the same commit.
- The `memory-leak-debugging` skill requires the `chrome-devtools` MCP server from `.mcp.json`, started with `--memoryDebugging`, for both heap-snapshot capture and analysis. Never read raw `.heapsnapshot` files directly.

## Git
- Never commit unless explicitly requested.
- Push branches with `git push no-mistakes`, never directly to `origin`. The gate reviews, tests, documents, and lints in a disposable worktree, then opens the PR only when everything passes. Use `/no-mistakes <task>` to do-and-gate, or bare `/no-mistakes` to gate committed work; it auto-applies safe mechanical fixes and escalates intent-level findings.
- Keep commit subjects as normal, human-readable summaries (for example `feat(core): add retry guard`).
- Every commit must carry a `Signed-off-by:` trailer matching the author for the DCO check; keep `DCO` required in branch protection so unsigned PRs cannot merge. Use `git commit -s`; the Husky `prepare-commit-msg` hook adds it automatically where hooks are installed.
- Do not replace commit messages with prompt text.
- `progress.md` is append-only: only add new entries at the end; never edit prior entries.
- For substantial agent-generated changes, add a `Repro-Prompt:` trailer in the commit message body.
