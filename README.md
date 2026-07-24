# pi-starter

Monorepo starter for solo maintainers shipping both deployable apps and publishable packages:
- Vercel-ready Next.js app in `apps/web`
- Shared package workspace in `packages/core`
- Append-only `progress.md` learning log for solo task memory
- ESM TypeScript
- Biome formatting/linting (tabs, indentWidth 3, lineWidth 120)
- Strict TypeScript
- `npm run check` gates formatting, linting, and type checking
- Fallow changed-code auditing for dead code, duplication, circular dependencies, and complexity regressions
- Optional max-lines-per-file check
- Codex-first agent starter layer with vendored guardrail scripts
- Curated vendored Vercel agent skills for React and UI work
- Curated vendored Addy Osmani agent skills for context, testing, review, security, and ADR workflows
- Curated vendored Matt Pocock skills for architecture review and domain vocabulary
- Vendored Chrome DevTools memory-leak debugging skill
- no-mistakes push gate for validated PR creation

Inspired by [badlogic/pi-mono](https://github.com/badlogic/pi-mono), [steipete/agent-scripts](https://github.com/steipete/agent-scripts), [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills), [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills), [mattpocock/skills](https://github.com/mattpocock/skills), [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp), [Fallow](https://github.com/fallow-rs/fallow), and [no-mistakes](https://github.com/kunchenguid/no-mistakes).

## Agent Rules

- Canonical source of agent instructions: `AGENTS.md` at repo root.
- Compatibility alias: `CLAUDE.md` is a tracked symlink to `AGENTS.md`; do not duplicate agent instructions across files.
- Keep tool-specific agent config optional and manual.
- Do not depend on symlink managers for this starter by default.
- Treat `progress.md` as solo operational memory for commits, releases, and deploys.
- Forks inherit `progress.md`; keep it tracked and continue appending project learnings in the fork instead of replacing the file.
- In `apps/web`, do not import `useEffect` directly. Prefer render-time derivation, event handlers, framework data loading, or `useMountEffect`.

## Setup

```bash
npm run doctor
npm install
npm run check
npm test
npm run fallow:audit
npm run agent:check
```

If you switch between `arm64` and `x64`, or between Rosetta and native Node, run `npm run reinstall:clean` to refresh native dependencies.

This starter is used across `darwin-x64`, `darwin-arm64`, and Linux environments. Keep `node_modules` machine-local and rerun `npm install` or `npm run reinstall:clean` whenever native dependencies stop matching the current OS or CPU architecture.

Initialize the push gate once per clone before shipping branches:

```bash
no-mistakes init
```

When work is committed on a feature branch, push with `git push no-mistakes` instead of pushing directly to `origin`. The gate validates the branch in a disposable worktree and opens the PR after the pinned pipeline passes.

## Start A Vercel App

`apps/web` is the default app target. Vercel should use `apps/web` as the root directory. No custom `vercel.json` is required for the starter.

GitHub Actions runs the required `Required checks` gate for pull requests and pushes to `main`; Vercel Git integration should remain responsible for deployment packaging only.

```bash
npm run dev -w @pi-starter/web
```

See `docs/deploying-to-vercel.md` for the minimal Vercel setup.

## Publish A Package

Shared package code lives in `packages/core`. Release scripts still default to build, validate, and log a learning entry before any publish step.

## Fork Workflow

When you fork this starter, `progress.md` comes with it. Keep that file in the fork so both humans and agents have a shared append-only learning log for commits, releases, deploys, and handoffs.

If you want to mark the fork boundary, append a new entry noting when the fork started and continue from there. Do not rewrite earlier entries.

## Agent Layer

- `agent/manifest.json` pins upstream source and vendored files.
- `agent/skills-manifest.json` pins a curated Vercel skills subset vendored under `agent/skills/vercel-labs/`.
- `agent/skills-manifest.addyosmani.json` pins a curated Addy Osmani skills subset vendored under `agent/skills/addyosmani/`.
- `agent/skills-manifest.mattpocock.json` pins a curated Matt Pocock skills subset vendored under `agent/skills/mattpocock/`.
- `agent/skills-manifest.chromedevtools.json` pins the Chrome DevTools memory-leak skill vendored under `agent/skills/chromedevtools/`.
- `scripts/agent-sync.mjs` syncs or verifies allowlisted upstream files.
- `scripts/committer` provides safe path-scoped commits.
- `scripts/commit-with-progress.mjs` wraps path-scoped commits and appends a required learning entry to `progress.md`.
- `scripts/progress-log.mjs` appends structured learning entries to `progress.md`.
- `scripts/progress-append-only-check.mjs` enforces append-only `progress.md` changes in pre-commit.
- `scripts/docs-list.mjs` validates docs front matter (`summary`, `read_when`) and prints a docs index without depending on `tsx`.
- `scripts/native-deps.mjs` and `scripts/preflight-native-deps.mjs` fail fast when native dependencies do not match the current machine.
- `.codex/prompts/` contains codex-first prompts: `/pickup`, `/handoff`, `/build-feature`, `/fix`, `/ship`.
- `.mcp.json` configures the `chrome-devtools` MCP server with memory debugging enabled for heap-snapshot capture.
- `.no-mistakes.yaml` pins the push-gate pipeline commands.
- `.fallowrc.json` declares intentional indirect entry points and keeps pull-request auditing scoped to new findings.
- `progress.md` is an append-only learning log for solo commits, releases, and deploys.
- `docs/agent-skills.md` explains which upstream skills are vendored and how to update them.
- `docs/architecture-decisions.md` defines the local ADR convention used when architectural choices should outlive the current session.

Use `/build-feature` for tracer-bullet feature delivery, `/fix` for end-to-end issue repair, and `/ship` for solo validation plus release/deploy handoff.

### Skill Packs

- `agent/skills/vercel-labs/*`: UI-focused guidance for React, Next.js, composition, interaction design, and transitions.
- `agent/skills/addyosmani/*`: process-focused guidance for context setup, test discipline, review rigor, security, and ADRs.
- `agent/skills/mattpocock/*`: architecture-review guidance for module depth, seams, domain language, and testable interfaces.
- `agent/skills/chromedevtools/*`: memory-leak debugging guidance for heap snapshots and memlab analysis.

PI Starter vendors only a small subset from each upstream source. The goal is to keep repo-local guidance pinned and stable without adopting an entire external workflow wholesale.

### Agent Commands

```bash
npm run doctor
npm run docs:list
npm run agent:verify-sync
npm run agent:sync
npm run skills:verify-sync
npm run skills:sync
npm run skills:addy:verify-sync
npm run skills:addy:sync
npm run skills:matt:verify-sync
npm run skills:matt:sync
npm run skills:chrome:verify-sync
npm run skills:chrome:sync
npm run skills:verify-sync:all
npm run skills:sync:all
npm run agent:check
npm run fallow:audit
npm run reinstall:clean
npm run commit:selective -- "chore: message" "path/to/file"
npm run commit:with-progress -- "chore: message" --learning "What changed and why it matters." -- "path/to/file"
npm run release:patch -- --learning "What we learned from this release."
npm run release:patch -- --learning "What we learned from this release." --publish --push
```

`npm run release:*` validates the bumped release tree before creating the release commit and tag. It skips `npm publish` and `git push` by default in this starter. Add `--publish` when you explicitly want to publish packages, and add `--push` when you explicitly want to push `main` and the release tag.

## Resources

Tooling and vendored skills this starter builds on:

- [no-mistakes](https://github.com/kunchenguid/no-mistakes) - AI-gated push proxy. All feature branch pushes go through `git push no-mistakes`, which validates the branch in a disposable worktree and opens the PR only when green. Pipeline commands are pinned in [`.no-mistakes.yaml`](./.no-mistakes.yaml).
- [Fallow](https://github.com/fallow-rs/fallow) - pinned Rust-native analysis for unused code, circular dependencies, duplication, and complexity. `npm run fallow:audit` gates only findings introduced relative to `origin/main`; GitHub Actions performs the equivalent pull-request-aware audit.
- [memory-leak-debugging skill](https://github.com/ChromeDevTools/chrome-devtools-mcp/tree/main/skills/memory-leak-debugging) from the Chrome DevTools team - vendored agent skill for diagnosing frontend and Node.js memory leaks with heap snapshots and [memlab](https://github.com/facebook/memlab). It requires the [chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp) server configured in [`.mcp.json`](./.mcp.json).

## Workspaces

- `@pi-starter/web`
- `@pi-starter/core`
