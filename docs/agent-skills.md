---
summary: "Curated vendored Vercel, Addy Osmani, and Matt Pocock agent skills plus the policy for keeping them pinned"
read_when:
  - Working on React, Next.js, UI review, or interaction patterns in this starter.
  - Working on context setup, testing strategy, review rigor, security checks, or ADRs in this starter.
  - Working on architecture review, refactoring, domain vocabulary, or testable module interfaces.
  - Running React Doctor or deciding how React Doctor findings should interact with local React rules.
  - Updating vendored skills from `vercel-labs/agent-skills`, `addyosmani/agent-skills`, or `mattpocock/skills`.
  - Deciding whether a new upstream skill belongs in the default starter layer.
---

# Agent Skills

PI Starter vendors three small upstream skill subsets so repo-local workflows can reference stable, pinned guidance without inheriting an entire external workflow.

## Pinned Upstream

### React Doctor

- Source repo: `https://github.com/millionco/react-doctor`
- Package: `react-doctor`
- Local config: `doctor.config.ts`
- Full scan: `npm run react:doctor`
- Changed-scope scan: `npm run react:doctor:changed`
- CI scan: `npm run react:doctor:ci`

React Doctor is a deterministic scanner, not a vendored skill pack. Keep its package version pinned in `package.json`, keep telemetry disabled through local scripts and config, and prefer patched dependency upgrades over suppressing security findings.

The root `package.json` currently includes a temporary scoped npm override for `next > postcss@8.5.10` to match the upstream Next canary fix for `GHSA-qx2v-qp2m-jg93`. Remove this override after stable Next declares `postcss >=8.5.10`.

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

## Selection Guide

| Need | Prefer |
| --- | --- |
| React, Next.js, UI, interaction, transitions, composition | Vercel UI pack |
| React Doctor scan output, React dependency advisories, changed-scope React regression checks | React Doctor |
| Session setup, test discipline, review rubric, security, ADR workflow | Addy process pack |
| Architecture review, module depth, seams, testable interfaces, domain vocabulary | Matt architecture pack |
| A task crosses multiple domains | Load the smallest relevant skill from each pack |

## What Stays Local

The starter keeps its own canonical workflow docs in `docs/` and its own deployment baseline in `docs/deploying-to-vercel.md`.

We intentionally do not vendor every upstream skill into the default starter. The following are currently excluded on purpose:

- `react-doctor` agent install output: the scanner is installed as a pinned npm dev dependency and configured locally instead
- `deploy-to-vercel`: broad operational workflow that overlaps with this starter's local deployment doc
- `vercel-cli-with-tokens`: token-handling workflow that should stay opt-in
- `react-native-skills`: outside the default web-first starter scope
- most Addy slash-command, persona, and hook files: useful upstream, but not part of this starter's repo-local default layer
- broad git, CI/CD, and shipping skills that would duplicate local release, progress-log, and deployment rules
- Matt Pocock's root-level workflow assumptions remain advisory where they conflict with PI Starter's `docs/adrs/` convention and Codex-first command flow

## Update Flow

1. Review the relevant upstream `skills/` tree and decide whether the curated subset should change.
2. Update the matching manifest with the new pinned commit or curated-scope changes.
3. Run the matching sync command:
   - `npm run skills:sync` for Vercel
   - `npm run skills:addy:sync` for Addy
   - `npm run skills:matt:sync` for Matt
4. Run the matching verify command:
   - `npm run skills:verify-sync` for Vercel
   - `npm run skills:addy:verify-sync` for Addy
   - `npm run skills:matt:verify-sync` for Matt
5. Run `npm run skills:validate` after skill file changes.
6. Run `npm run docs:list` if this doc or other docs changed.
7. Run `npm run agent:check` before handoff or ship.

## Multi-Machine Note

`docs:list`, `skills:sync`, `skills:verify-sync`, `skills:addy:sync`, `skills:addy:verify-sync`, `skills:matt:sync`, and `skills:matt:verify-sync` are Node-only and should work even when native packages need reinstalling.

`npm run check` still depends on native packages such as Biome, esbuild, and the TypeScript native preview build. After moving between `darwin-x64`, `darwin-arm64`, Linux, or Rosetta/native modes, reinstall dependencies on that machine before running `npm run check`.
