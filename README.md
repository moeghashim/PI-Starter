# pi-starter

Monorepo template following the pi-mono style:
- ESM TypeScript
- Biome formatting/linting (tabs, indentWidth 3, lineWidth 120)
- Strict TypeScript
- `npm run check` gates formatting, linting, and type checking
- Optional max-lines-per-file check
- Codex-first agent starter layer with vendored guardrail scripts

Inspired by [badlogic/pi-mono](https://github.com/badlogic/pi-mono).

## Agent Rules

- Canonical source of agent instructions: `AGENTS.md` at repo root.
- Keep tool-specific agent config optional and manual.
- Do not depend on symlink managers for this starter by default.
- This starter does not enforce local CLI merge blockers; solo maintainers are expected to use judgment and checks before merging.

## Setup

```bash
npm install
npm run check
npm test
npm run agent:check
```

## Agent Layer

- `agent/manifest.json` pins upstream source and vendored files.
- `scripts/agent-sync.mjs` syncs or verifies allowlisted upstream files.
- `scripts/committer` provides safe path-scoped commits.
- `scripts/commit-with-progress.mjs` wraps path-scoped commits and appends a required learning entry to `progress.md`.
- `scripts/progress-log.mjs` appends structured learning entries to `progress.md`.
- `scripts/progress-append-only-check.mjs` enforces append-only `progress.md` changes in pre-commit.
- `scripts/docs-list.ts` validates docs front matter (`summary`, `read_when`) and prints a docs index.
- `.codex/prompts/` contains codex-first prompts: `/pickup`, `/handoff`, `/fix`, `/landpr`.
- `progress.md` is an append-only learning log for commit and deploy events.

### Agent Commands

```bash
npm run docs:list
npm run agent:verify-sync
npm run agent:sync
npm run agent:check
npm run commit:selective -- "chore: message" "path/to/file"
npm run commit:with-progress -- "chore: message" --learning "What changed and why it matters." -- "path/to/file"
npm run release:patch -- --learning "What we learned from this release."
```

## Packages

- `@pi-starter/core`
