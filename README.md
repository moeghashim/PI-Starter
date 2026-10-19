# pi-starter

Monorepo starter for solo maintainers shipping both deployable apps and publishable packages:
- Vercel-ready or Cloudflare Workers-ready Next.js app in `apps/web`
- Shared package workspace in `packages/core`
- Append-only `progress.md` learning log for solo task memory
- Node 24 LTS, pinned by major in `.nvmrc`
- ESM TypeScript with strict checking, compiled by the native TypeScript 7 compiler; `apps/web` stays on TypeScript 5 for Next.js
- Biome formatting/linting (tabs, indentWidth 3, lineWidth 120)
- `npm run check` gates formatting, linting, and type checking
- `npm run fix` explicitly applies formatting and lint fixes for review
- Fallow changed-code auditing for dead code, duplication, circular dependencies, and complexity regressions
- Optional max-lines-per-file check
- Harness-native agent skills in `.agents/skills/` (also exposed as `.claude/skills`) with vendored guardrail scripts
- Curated vendored Vercel agent skills for React and UI work
- Curated vendored Addy Osmani agent skills for context, testing, review, security, and ADR workflows
- Curated vendored Matt Pocock skills for architecture review and domain vocabulary
- Vendored Chrome DevTools memory-leak debugging skill
- no-mistakes push gate for validated PR creation
- Weekly grouped Dependabot updates for npm and GitHub Actions

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

## Host The Web App

`apps/web` is the default app target. Choose one default host for a fork and keep provider settings separate.

- Vercel: use `apps/web` as the Vercel root directory and `npm run build` as the build command. No custom `vercel.json` is required.
- Cloudflare: use the repository root in Workers Builds and `npm run deploy:cloudflare` as the deploy command. Cloudflare configuration lives in `apps/web/wrangler.jsonc` and `apps/web/open-next.config.ts`.

GitHub Actions runs the required `Required checks` gate and the `Cloudflare build` packaging job for pull requests and pushes to `main`, plus the `Fallow audit` check on pull requests; hosting providers remain responsible for deployment packaging only.

`Required checks` is a stable aggregate status for branch protection: it requires both OS matrix checks and the Cloudflare build to succeed, plus Fallow on pull requests. Failures, cancellations, or unexpected skips fail the aggregate rather than leaving a missing status. The Cloudflare job runs the only full Next.js production build; the matrix jobs build the packages and generate Next.js route types for type checking.

In branch protection for `main`, require `Required checks` and `DCO`. Commits must carry a `Signed-off-by` trailer, and DCO only blocks merges once it is a required check.

```bash
npm run dev -w @pi-starter/web
```

See `docs/deploying-to-vercel.md` and `docs/deploying-to-cloudflare.md` for provider-specific setup.

## Publish A Package

Shared package code lives in `packages/core`. Release scripts still default to build, validate, and log a learning entry before any publish step.

## Fork Workflow

When you fork this starter, `progress.md` comes with it. Keep that file in the fork so both humans and agents have a shared append-only learning log for commits, releases, deploys, and handoffs.

If you want to mark the fork boundary, append a new entry noting when the fork started and continue from there. Do not rewrite earlier entries.

## Agent Layer

- `agent/manifest.json` pins upstream source and vendored scripts.
- `agent/skills-manifest*.json` pin one curated upstream skill pack each: Vercel, Addy Osmani, Matt Pocock, and Chrome DevTools. Each vendors into `.agents/skills/`.
- `scripts/agent-sync.mjs` syncs allowlisted upstream files, verifies them against the pinned upstream commit, or verifies them offline against the manifest hashes (`verify-local`). See `docs/agent-skills.md` for how `agent:check` and `agent:verify-upstream` use these modes.
- `scripts/committer` provides safe path-scoped commits. It started from steipete/agent-scripts, which has since removed it, so it is now maintained here.
- `scripts/commit-with-progress.mjs` wraps path-scoped commits and appends a required learning entry to `progress.md`.
- `scripts/progress-log.mjs` appends structured learning entries to `progress.md`.
- `scripts/progress-append-only-check.mjs` enforces append-only `progress.md` changes in pre-commit.
- `scripts/docs-list.mjs` validates docs front matter (`summary`, `read_when`) and prints a docs index without depending on `tsx`.
- `scripts/native-deps.mjs` and `scripts/preflight-native-deps.mjs` fail fast when native dependencies do not match the current machine.
- `scripts/test/*.test.mjs` are root regression tests that `npm test` runs before workspace tests; they cover the pre-commit hook, version bumps, release safeguards, Cloudflare binding type generation, the CI gate configuration, and repository automation (the `progress.md` append-only check, `scripts/sync-versions.js`, docs front-matter validation, `scripts/committer`, and the offline vendored-file verifier).
- `apps/web/scripts/cloudflare-typegen.mjs` regenerates `apps/web/cloudflare-env.d.ts` from `apps/web/wrangler.jsonc` through `npm run typegen:cloudflare`.
- `.agents/skills/` is the single skill directory that agent harnesses discover; `.claude/skills` is a tracked symlink to it. It holds the vendored packs plus the local workflow skills `/pickup`, `/handoff`, `/build-feature`, `/fix`, `/ship`.
- `.mcp.json` configures the `chrome-devtools` MCP server with memory debugging enabled for heap-snapshot capture.
- `.no-mistakes.yaml` pins the push-gate pipeline commands.
- `.fallowrc.json` declares intentional indirect entry points and keeps pull-request auditing scoped to new findings.
- `progress.md` is an append-only learning log for solo commits, releases, and deploys.
- `docs/agent-skills.md` explains which upstream skills are vendored and how to update them.
- `docs/architecture-decisions.md` defines the local ADR convention used when architectural choices should outlive the current session.

Use `/build-feature` for tracer-bullet feature delivery, `/fix` for end-to-end issue repair, and `/ship` for solo validation plus release/deploy handoff.

### Skill Packs

- Vercel (`react-best-practices`, `composition-patterns`, `react-view-transitions`, `web-design-guidelines`): UI-focused guidance for React, Next.js, composition, interaction design, and transitions.
- Addy Osmani (`context-engineering`, `test-driven-development`, `code-review-and-quality`, `documentation-and-adrs`, `security-and-hardening`, `debugging-and-error-recovery`, `performance-optimization`, `observability-and-instrumentation`, `constraint-driven-development`, `browser-testing-with-devtools`): process-focused guidance for context setup, test discipline, review rigor, security, ADRs, debugging, performance, and observability.
- Matt Pocock (`improve-codebase-architecture`, `codebase-design`, `domain-modeling`, `grilling`): architecture-review guidance for module depth, seams, domain language, and testable interfaces.
- Chrome DevTools (`memory-leak-debugging`): memory-leak debugging guidance using the Chrome DevTools MCP heap snapshot tools.

PI Starter vendors only a small subset from each upstream source. The goal is to keep repo-local guidance pinned and stable without adopting an entire external workflow wholesale.

### Agent Commands

```bash
npm run doctor
npm run docs:list
npm run agent:check
npm run skills:verify
npm run skills:sync
npm run skills:sync -- --manifest agent/skills-manifest.mattpocock.json
npm run agent:verify-upstream
npm run fallow:audit
npm run reinstall:clean
npm run preview:cloudflare
npm run build:cloudflare
npm run deploy:cloudflare
npm run typegen:cloudflare
npm run commit:selective -- "chore: message" "path/to/file"
npm run commit:with-progress -- "chore: message" --learning "What changed and why it matters." -- "path/to/file"
npm run release:patch -- --learning "What we learned from this release."
npm run release:tag
npm run release:tag -- --publish
```

`agent:check` and `skills:verify` work offline. `skills:sync` and `agent:verify-upstream` fetch from GitHub and cover every manifest unless you pass `--manifest`.

Releases go through a pull request like any other change. On clean `main` matching `origin/main`, `npm run release:<patch|minor|major> -- --learning "..."` bumps versions on a `release/vX.Y.Z` branch, refuses a version whose tag already exists, validates the bumped tree, and makes one signed `chore(release): vX.Y.Z` commit. Push that branch with `git push no-mistakes`. After the pull request merges, run `npm run release:tag` from any clean checkout: it fetches `origin/main`, tags the merged `chore(release)` commit found there, and pushes only the tag. Rerunning it is safe. Add `-- --publish` to publish packages; that requires the checkout to be at the release commit. Nothing pushes `main` directly, so releases pass the same CI and DCO checks as every other change.

## Resources

Tooling and vendored skills this starter builds on:

- [no-mistakes](https://github.com/kunchenguid/no-mistakes) - AI-gated push proxy. All feature branch pushes go through `git push no-mistakes`, which validates the branch in a disposable worktree and opens the PR only when green. Pipeline commands are pinned in [`.no-mistakes.yaml`](./.no-mistakes.yaml).
- [Fallow](https://github.com/fallow-rs/fallow) - pinned Rust-native analysis for unused code, circular dependencies, duplication, and complexity. `npm run fallow:audit` gates only findings introduced relative to `origin/main`; GitHub Actions performs the equivalent pull-request-aware audit.
- [OpenNext Cloudflare](https://opennext.js.org/cloudflare) - packages the Next.js workspace for Cloudflare Workers while leaving Vercel configuration independent.
- [memory-leak-debugging skill](https://github.com/ChromeDevTools/chrome-devtools-mcp/tree/main/skills/memory-leak-debugging) from the Chrome DevTools team - vendored agent skill for diagnosing frontend and Node.js memory leaks with heap snapshots. It requires the [chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp) server configured in [`.mcp.json`](./.mcp.json).

## Workspaces

- `@pi-starter/web`
- `@pi-starter/core`
