---
summary: "Codex-first workflow for pickup, execution, handoff, and guardrail checks"
read_when:
  - Starting work in a fresh session.
  - Handing off work to another agent or engineer.
  - Preparing to run guardrail checks before finalizing changes.
---

# Agent Workflow

## Start

1. Read `AGENTS.md` and the relevant docs in this folder.
2. Run `npm run docs:list` to confirm docs metadata is valid.
3. Use `/pickup` from `.codex/prompts/pickup.md` to rehydrate context.

## Execute

1. Keep edits scoped and explicit.
2. Prefer `npm run commit:selective -- "<message>" "<path>" ...` for path-scoped commits when committing is requested.
3. Keep public package APIs re-exported through `src/index.ts`.

## Validate

1. Run `npm run check` for code quality.
2. Run `npm test` for test coverage.
3. Run `npm run agent:check` before handoff to validate docs, AGENTS structure, and vendored sync.

## Handoff

1. Use `/handoff` to summarize status, risks, checks run, and next actions.
2. Include exact commands for any remaining validation or CI follow-up.
