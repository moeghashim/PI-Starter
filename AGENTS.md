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

## Commands
- After code changes (not docs changes): `npm run check`
- Fix all errors, warnings, and infos before committing.

## Agent Workflow
- Agent workflow docs live in `docs/agent-workflow.md` and command index in `docs/commands.md`.
- Run `npm run docs:list` whenever docs are added or updated.
- Run `npm run agent:check` before handoff to validate docs front matter, AGENTS structure, and vendored sync integrity.
- Use `npm run commit:selective -- "type(scope): summary" "path/one" "path/two"` for path-scoped commits.

## Git
- Never commit unless explicitly requested.
- Keep commit subjects as normal, human-readable summaries (for example `feat(core): add retry guard`).
- Do not replace commit messages with prompt text.
- For substantial agent-generated changes, include a reproducibility prompt:
  - Prefer adding it to the PR description.
  - If there is no PR, add a `Repro-Prompt:` trailer in the commit message body.
