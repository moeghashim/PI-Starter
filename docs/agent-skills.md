---
summary: "Curated vendored Vercel, Addy Osmani, Matt Pocock, and Chrome DevTools agent skills plus the policy for keeping them pinned"
read_when:
  - Working on React, Next.js, UI review, or interaction patterns in this starter.
  - Working on context setup, testing strategy, review rigor, security checks, or ADRs in this starter.
  - Working on architecture review, refactoring, domain vocabulary, or testable module interfaces.
  - Diagnosing frontend or Node.js memory leaks with heap snapshots or memlab.
  - Updating vendored skills from `vercel-labs/agent-skills`, `addyosmani/agent-skills`, `mattpocock/skills`, or `ChromeDevTools/chrome-devtools-mcp`.
  - Deciding whether a new upstream skill belongs in the default starter layer.
---

# Agent Skills

PI Starter vendors four small upstream skill subsets so repo-local workflows can reference stable, pinned guidance without inheriting an entire external workflow.

## Pinned Upstream

### Vercel UI Pack

- Source repo: `https://github.com/vercel-labs/agent-skills`
- Manifest: `agent/skills-manifest.json`
- Sync command: `npm run skills:sync`
- Verify command: `npm run skills:verify-sync`

### Addy Process Pack

- Source repo: `https://github.com/addyosmani/agent-skills`
- Manifest: `agent/skills-manifest.addyosmani.json`
- Sync command: `npm run skills:addy:sync`
- Verify command: `npm run skills:addy:verify-sync`

### Matt Architecture Pack

- Source repo: `https://github.com/mattpocock/skills`
- Manifest: `agent/skills-manifest.mattpocock.json`
- Sync command: `npm run skills:matt:sync`
- Verify command: `npm run skills:matt:verify-sync`

### Chrome DevTools Memory Pack

- Source repo: `https://github.com/ChromeDevTools/chrome-devtools-mcp`
- Manifest: `agent/skills-manifest.chromedevtools.json`
- Sync command: `npm run skills:chrome:sync`
- Verify command: `npm run skills:chrome:verify-sync`
- MCP server: `chrome-devtools` in `.mcp.json`
- Analysis dependency: `npx memlab`

## Vendored Skills

### Vercel UI Pack

- `agent/skills/vercel-labs/react-best-practices`
- `agent/skills/vercel-labs/composition-patterns`
- `agent/skills/vercel-labs/react-view-transitions`
- `agent/skills/vercel-labs/web-design-guidelines`

- building or refactoring React and Next.js code
- reviewing UI code for accessibility or web interaction issues
- designing component APIs that should avoid prop sprawl
- adding view transitions or route-level motion

### Addy Process Pack

- `agent/skills/addyosmani/context-engineering`
- `agent/skills/addyosmani/test-driven-development`
- `agent/skills/addyosmani/code-review-and-quality`
- `agent/skills/addyosmani/documentation-and-adrs`
- `agent/skills/addyosmani/security-and-hardening`

- setting up or recovering task context at the start of a session
- proving behavior with failing tests first or regression tests
- reviewing a change across correctness, readability, architecture, security, and performance
- recording architecture decisions and durable rationale in repo-local docs
- hardening features that accept input, handle auth, or integrate external services

### Matt Architecture Pack

- `agent/skills/mattpocock/improve-codebase-architecture`
- `agent/skills/mattpocock/domain-model`

- reviewing code for shallow modules and deepening opportunities
- naming domain concepts before introducing new module seams
- comparing interface designs before refactoring a module
- improving locality and test leverage without copying the upstream ADR layout wholesale

### Chrome DevTools Memory Pack

- `agent/skills/chromedevtools/memory-leak-debugging`

- diagnosing high memory usage, OOM errors, detached DOM nodes, unremoved listeners, unbounded caches, or closure leaks
- capturing frontend heap snapshots through the `chrome-devtools` MCP server with memory debugging enabled
- analyzing snapshots with `npx memlab` or the vendored fallback comparison script
- avoiding direct reads of raw `.heapsnapshot` files, which are too large for agent context

## Selection Guide

| Need | Prefer |
| --- | --- |
| React, Next.js, UI, interaction, transitions, composition | Vercel UI pack |
| Session setup, test discipline, review rubric, security, ADR workflow | Addy process pack |
| Architecture review, module depth, seams, testable interfaces, domain vocabulary | Matt architecture pack |
| Frontend or Node.js memory leak triage, heap snapshots, memlab analysis | Chrome DevTools memory pack |
| A task crosses multiple domains | Load the smallest relevant skill from each pack |

## What Stays Local

The starter keeps its own canonical workflow docs in `docs/` and its own deployment baseline in `docs/deploying-to-vercel.md`.

We intentionally do not vendor every upstream skill into the default starter. The following are currently excluded on purpose:

- `deploy-to-vercel`: broad operational workflow that overlaps with this starter's local deployment doc
- `vercel-cli-with-tokens`: token-handling workflow that should stay opt-in
- `react-native-skills`: outside the default web-first starter scope
- most Addy slash-command, persona, and hook files: useful upstream, but not part of this starter's repo-local default layer
- broad git, CI/CD, and shipping skills that would duplicate local release, progress-log, and deployment rules
- Matt Pocock's root-level workflow assumptions remain advisory where they conflict with PI Starter's `docs/adrs/` convention and Codex-first command flow
- Chrome DevTools' full plugin install flow: PI Starter vendors only the memory-leak skill and configures the project MCP server locally

## Update Flow

1. Review the relevant upstream `skills/` tree and decide whether the curated subset should change.
2. Update the matching manifest with the new pinned commit or curated-scope changes.
3. Run the matching sync command:
   - `npm run skills:sync` for Vercel
   - `npm run skills:addy:sync` for Addy
   - `npm run skills:matt:sync` for Matt
   - `npm run skills:chrome:sync` for Chrome DevTools
4. Run the matching verify command:
   - `npm run skills:verify-sync` for Vercel
   - `npm run skills:addy:verify-sync` for Addy
   - `npm run skills:matt:verify-sync` for Matt
   - `npm run skills:chrome:verify-sync` for Chrome DevTools
5. Run `npm run docs:list` if this doc or other docs changed.
6. Run `npm run agent:check` before handoff or ship.

## Multi-Machine Note

`docs:list`, `skills:sync`, `skills:verify-sync`, `skills:addy:sync`, `skills:addy:verify-sync`, `skills:matt:sync`, `skills:matt:verify-sync`, `skills:chrome:sync`, and `skills:chrome:verify-sync` are Node-only and should work even when native packages need reinstalling.

`npm run check` still depends on native packages such as Biome, esbuild, and the TypeScript native preview build. After moving between `darwin-x64`, `darwin-arm64`, Linux, or Rosetta/native modes, reinstall dependencies on that machine before running `npm run check`.
