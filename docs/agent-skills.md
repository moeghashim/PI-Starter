---
summary: "Curated vendored Vercel, Addy Osmani, Matt Pocock, and Chrome DevTools agent skills plus the policy for keeping them pinned"
read_when:
  - Working on React, Next.js, UI review, or interaction patterns in this starter.
  - Working on context setup, testing strategy, review rigor, security checks, or ADRs in this starter.
  - Working on architecture review, refactoring, domain vocabulary, or testable module interfaces.
  - Diagnosing frontend or Node.js memory leaks with heap snapshots.
  - Adding, moving, or renaming a skill directory under `.agents/skills/`.
  - Updating vendored skills from `vercel-labs/agent-skills`, `addyosmani/agent-skills`, `mattpocock/skills`, or `ChromeDevTools/chrome-devtools-mcp`.
  - Deciding whether a new upstream skill belongs in the default starter layer.
---

# Agent Skills

PI Starter vendors four small upstream skill subsets so repo-local workflows can reference stable, pinned guidance without inheriting an entire external workflow.

## Layout

Every skill lives at `.agents/skills/<name>/SKILL.md`, one flat directory per skill, which is the layout agent harnesses discover natively. `.claude/skills` is a tracked symlink to `../.agents/skills` for harnesses that read that location. The pack a vendored skill belongs to is recorded in its manifest, not in its path. The local workflow skills (`pickup`, `handoff`, `build-feature`, `fix`, `ship`) sit in the same directory and are indexed in `docs/commands.md`. See `docs/adrs/2026-10-04-native-skill-layout.md`.

## Pinned Upstream

### Vercel UI Pack

- Source repo: `https://github.com/vercel-labs/agent-skills`
- Manifest: `agent/skills-manifest.json`

### Addy Process Pack

- Source repo: `https://github.com/addyosmani/agent-skills`
- Manifest: `agent/skills-manifest.addyosmani.json`

### Matt Architecture Pack

- Source repo: `https://github.com/mattpocock/skills`
- Manifest: `agent/skills-manifest.mattpocock.json`

### Chrome DevTools Memory Pack

- Source repo: `https://github.com/ChromeDevTools/chrome-devtools-mcp`
- Manifest: `agent/skills-manifest.chromedevtools.json`
- MCP server: `chrome-devtools` in `.mcp.json`, started with `--memoryDebugging`

## Vendored Skills

### Vercel UI Pack

- `.agents/skills/react-best-practices`
- `.agents/skills/composition-patterns`
- `.agents/skills/react-view-transitions`
- `.agents/skills/web-design-guidelines`

- building or refactoring React and Next.js code
- reviewing UI code for accessibility or web interaction issues
- designing component APIs that should avoid prop sprawl
- adding view transitions or route-level motion

### Addy Process Pack

- `.agents/skills/context-engineering`
- `.agents/skills/test-driven-development`
- `.agents/skills/code-review-and-quality`
- `.agents/skills/documentation-and-adrs`
- `.agents/skills/security-and-hardening`
- `.agents/skills/debugging-and-error-recovery`
- `.agents/skills/performance-optimization`
- `.agents/skills/observability-and-instrumentation`
- `.agents/skills/constraint-driven-development`
- `.agents/skills/browser-testing-with-devtools`

- setting up or recovering task context at the start of a session
- proving behavior with failing tests first or regression tests
- reviewing a change across correctness, readability, architecture, security, and performance
- recording architecture decisions and durable rationale in repo-local docs
- hardening features that accept input, handle auth, or integrate external services
- debugging failures systematically, and measuring before optimizing performance
- adding logs, metrics, and traces, and stating constraints a change must hold
- verifying behavior in a real browser through the `chrome-devtools` MCP server

The last five skills are vendored because the core Addy skills refer to them by name.

### Matt Architecture Pack

- `.agents/skills/improve-codebase-architecture`
- `.agents/skills/codebase-design`
- `.agents/skills/domain-modeling`
- `.agents/skills/grilling`

- reviewing code for shallow modules and deepening opportunities
- naming domain concepts before introducing new module seams
- comparing interface designs before refactoring a module
- improving locality and test leverage without copying the upstream ADR layout wholesale

`improve-codebase-architecture` calls `codebase-design`, `domain-modeling`, and `grilling` by name, so the four are vendored together. Upstream writes ADRs to `docs/adr/` with numbered filenames and keeps a root `GLOSSARY.md`; in this repo ADRs stay in `docs/adrs/` using `docs/architecture-decisions.md`.

### Chrome DevTools Memory Pack

- `.agents/skills/memory-leak-debugging`

- diagnosing high memory usage, OOM errors, detached DOM nodes, unremoved listeners, unbounded caches, or closure leaks
- capturing frontend heap snapshots through the `chrome-devtools` MCP server with memory debugging enabled
- summarizing and comparing snapshots with the MCP server's heap snapshot tools
- avoiding direct reads of raw `.heapsnapshot` files, which are too large for agent context

## Selection Guide

| Need | Prefer |
| --- | --- |
| React, Next.js, UI, interaction, transitions, composition | Vercel UI pack |
| Session setup, test discipline, review rubric, security, ADR workflow, debugging, performance, observability | Addy process pack |
| Architecture review, module depth, seams, testable interfaces, domain vocabulary | Matt architecture pack |
| Frontend or Node.js memory leak triage and heap snapshot analysis | Chrome DevTools memory pack |
| A task crosses multiple domains | Load the smallest relevant skill from each pack |

## What Stays Local

The starter keeps its own canonical workflow docs in `docs/` and its own deployment baselines in `docs/deploying-to-vercel.md` and `docs/deploying-to-cloudflare.md`.

We intentionally do not vendor every upstream skill into the default starter. The following are currently excluded on purpose:

- `deploy-to-vercel`: broad operational workflow that overlaps with this starter's Vercel deployment doc
- `vercel-cli-with-tokens`: token-handling workflow that should stay opt-in
- `react-native-skills`: outside the default web-first starter scope
- most Addy slash-command, persona, and hook files: useful upstream, but not part of this starter's repo-local default layer
- broad git, CI/CD, and shipping skills that would duplicate local release, progress-log, and deployment rules. `observability-and-instrumentation` mentions Addy's `shipping-and-launch`; the local `ship` skill covers that role instead.
- Matt Pocock's root-level workflow assumptions remain advisory where they conflict with PI Starter's `docs/adrs/` convention and local workflow skills
- Chrome DevTools' full plugin install flow: PI Starter vendors only the memory-leak skill and configures the project MCP server locally

## Update Flow

1. Review the relevant upstream `skills/` tree and decide whether the curated subset should change.
2. Update the matching manifest with the new pinned commit or curated-scope changes. Each entry's `localPath` must be `.agents/skills/<upstream directory name>`; check that the name does not collide with a skill from another pack or a local workflow skill. Manifest entries may declare `rewrites` (exact `search`/`replace` strings scoped to a `path`) to adapt upstream file references to this repo's layout; rewrites are applied before hashing, so the pinned `sha256` covers the rewritten content.
3. Run `npm run skills:sync -- --manifest <manifest path>` to re-vendor that pack, or `npm run skills:sync` for every pack.
4. Run `npm run agent:verify-upstream` to confirm every manifest hash matches its pinned upstream commit.
5. Run `npm run docs:list` if this doc or other docs changed.
6. Run `npm run agent:check` before handoff or ship.

## Integrity Versus Provenance

Two checks protect vendored files:

- Integrity: `npm run agent:check` runs `npm run skills:verify`, which checks every manifest. It hashes the files on disk and compares them to each manifest `sha256`, with no network access. Editing a vendored file without updating its manifest fails this check.
- Provenance: `npm run agent:verify-upstream` checks every manifest against upstream. It fetches the pinned upstream commit and confirms each manifest `sha256` still matches upstream. This catches a manifest hash edited to match tampered local files. CI runs it once per push on Ubuntu.

Treat manifest diffs as security-relevant in review, since integrity alone trusts whatever hash the manifest records.

`skills:sync` and `agent:verify-upstream` fetch from the GitHub API; `agent:check` does not. When `GITHUB_TOKEN` or `GH_TOKEN` is set, requests are authenticated; set one in CI, where unauthenticated runners hit the 60-requests-per-hour rate limit.

## Multi-Machine Note

`docs:list`, `agent:check`, `skills:sync`, `skills:verify`, and `agent:verify-upstream` are Node-only and should work even when native packages need reinstalling.

`npm run check` still depends on native packages such as Biome, esbuild, and the native TypeScript 7 compiler. After moving between `darwin-x64`, `darwin-arm64`, Linux, or Rosetta/native modes, reinstall dependencies on that machine before running `npm run check`.
