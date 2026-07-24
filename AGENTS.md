# Development Rules

## Code Quality
- No `any` types unless absolutely necessary.
- Check `node_modules` for external API type definitions instead of guessing.
- NEVER use inline imports:
  - no `await import("./foo.js")`
  - no `import("pkg").Type` in type positions
  - no dynamic imports for types
  - always use standard top-level imports
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
- After code changes (not docs changes): `npm run check`
- Before handoff or ship, run `npm run fallow:audit` to block newly introduced dead code, duplication, and complexity findings against `origin/main`.
- Fix all errors, warnings, and infos before committing.
- Keep `node_modules` machine-local. After moving between `darwin-x64`, `darwin-arm64`, Linux, or Rosetta/native modes, run `npm install` or `npm run reinstall:clean` before using native-tooling commands.

## Database Deployments
- Treat app deployment and database deployment as separate release surfaces.
- Before shipping an app, check whether the diff touches schema, migrations, ORM configuration, seed data, database clients, or database environment variables.
- If database changes are present, identify and run the project-specific database deploy or migration command before reporting the app as fully shipped.
- If the database deploy cannot be run, call that out as a blocking or pending release step with the exact command or owner needed.

## Agent Workflow
- Agent workflow docs live in `docs/agent-workflow.md`, skill guidance in `docs/agent-skills.md`, and command index in `docs/commands.md`.
- At task start, review recent entries in `progress.md` to understand prior learnings.
- Treat `progress.md` as part of the starter contract for forks; keep it tracked, preserve the append-only history, and continue the log in derived repos.
- Keep `CLAUDE.md` as a tracked symlink to `AGENTS.md`; `AGENTS.md` remains the canonical source of agent instructions.
- Run `npm run docs:list` whenever docs are added or updated.
- Run `npm run skills:verify-sync` after changing vendored Vercel skills or their pinned manifest.
- Run `npm run skills:addy:verify-sync` after changing vendored Addy Osmani skills or their pinned manifest.
- Run `npm run skills:matt:verify-sync` after changing vendored Matt Pocock skills or their pinned manifest.
- Run `npm run skills:chrome:verify-sync` after changing vendored Chrome DevTools skills or their pinned manifest.
- Run `npm run agent:check` before handoff to validate docs front matter, AGENTS structure, and vendored sync integrity.
- Use `npm run commit:selective -- "type(scope): summary" "path/one" "path/two"` for path-scoped commits.
- For agent-requested commits, use `npm run commit:with-progress -- "type(scope): summary" --learning "what was learned" -- "path/one" "path/two"` so `progress.md` is appended in the same commit.
- The `memory-leak-debugging` skill requires the `chrome-devtools` MCP server configured in `.mcp.json` for heap-snapshot capture, and `memlab` via `npx memlab` for analysis. Without the MCP server, only the memlab and fallback-script analysis steps are usable. Never read raw `.heapsnapshot` files directly.

## Git
- Never commit unless explicitly requested.
- Push branches through `git push no-mistakes`, never directly to `origin`. The gate runs review, test, docs, and lint in a disposable worktree, forwards the branch only when everything passes, and opens the PR. Use `/no-mistakes <task>` to do-and-gate, or bare `/no-mistakes` to gate already-committed work. Safe mechanical fixes are auto-applied; intent-level findings are escalated for human approval.
- Keep commit subjects as normal, human-readable summaries (for example `feat(core): add retry guard`).
- Do not replace commit messages with prompt text.
- `progress.md` is append-only: only add new entries at the end; never edit prior entries.
- For substantial agent-generated changes, add a `Repro-Prompt:` trailer in the commit message body.
