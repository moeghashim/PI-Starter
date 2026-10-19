---
summary: "Store all skills in the harness-native .agents/skills layout with .claude/skills as a symlink"
read_when:
  - Adding, moving, renaming, or vendoring a skill.
  - Re-evaluating where agent skills or workflow prompts live in this starter.
---

# Native Skill Layout

## Status

Accepted

## Context

Vendored skills lived under `agent/skills/<vendor>/<name>/` and the five workflow prompts under `.codex/prompts/`. Neither path is a location agent harnesses scan, so no skill or prompt loaded on its own: agents only reached them when a doc told them to open a path, and `/pickup`, `/fix`, and `/ship` were not available as commands.

The Matt Pocock pin had also fallen behind an upstream restructure that moved skills under `skills/engineering/` and `skills/productivity/`, renamed `domain-model` to `domain-modeling`, and made `improve-codebase-architecture` call `codebase-design`, `domain-modeling`, and `grilling` by name.

## Decision

All skills live at `.agents/skills/<name>/SKILL.md`, one flat directory per skill. `.claude/skills` is a tracked symlink to `../.agents/skills`.

The workflow prompts became local skills in the same directory (`pickup`, `handoff`, `build-feature`, `fix`, `ship`) and `.codex/prompts/` was removed. `ship` sets `disable-model-invocation: true` because it pushes.

Vendored skills keep their upstream directory names. Pack membership is recorded only in the `agent/skills-manifest*.json` files, which still pin each directory by commit and sha256. The Matt pack is re-pinned and now vendors `improve-codebase-architecture`, `codebase-design`, `domain-modeling`, and `grilling` together.

`npm run agent:check` enforces the symlink and requires every directory in `.agents/skills/` to contain a `SKILL.md` with `name` and `description`.

## Consequences

Skills load by description and as slash commands in harnesses that read `.agents/skills` or `.claude/skills`, and workflow skills refer to other skills by name instead of by path.

Skill names share one namespace. Adding a vendored skill requires checking for a collision with other packs and with the local workflow skills.

A vendored directory can no longer be recognized by its path; the manifests are the only record of which directories are upstream-owned and must not be hand-edited.

Checkouts without symlink support (Windows without developer mode) get `.claude/skills` as a plain file and must read `.agents/skills` directly.

## Alternatives Considered

- Keep `agent/skills/<vendor>/` and symlink each skill into `.agents/skills/`: preserves vendor grouping but adds one tracked symlink per skill that sync would have to maintain.
- Generate `.agents/skills/` at install time: keeps one source of truth but makes skills absent in fresh clones and disposable gate worktrees until a script runs.
- Prefix vendored directories with the vendor name: avoids collisions but breaks upstream skills that call each other by name.
