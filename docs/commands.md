---
summary: "Index of the local workflow skills and the batch gate commands"
read_when:
  - Looking up the in-repo workflow skills.
  - Looking up a batch gate, light check, or PR size command.
  - Updating the workflows for pickup, handoff, feature delivery, fixes, or solo shipping.
---

# Workflow Skill Index

Local workflow skills are stored under `.agents/skills/<name>/SKILL.md`, next to the vendored packs described in `docs/agent-skills.md`. `.claude/skills` is a symlink to the same directory, so harnesses that read either location discover them as slash commands.

- `/pickup`: Session rehydration checklist before starting work.
- `/handoff`: Structured handoff notes for the next agent.
- `/build-feature`: Tracer-bullet workflow for net-new features, starting with one tiny end-to-end slice.
- `/fix`: End-to-end issue fix workflow with tests and checks.
- `/ship`: End-to-end solo shipping workflow through `git push no-mistakes` plus deploy/release follow-through. User-invoked only.

These five directories are local, not vendored; edit them directly.

## Batch gates

From the gate operator's initialized clone or a linked worktree:

- `npm run batch -- target` opens or finds the batch ref that takes new tasks.
- `npm run batch -- task <intent-file>` runs the light gate for the current committed task.
- `npm run batch -- target repair` returns the oldest batch for a fix branch.
- `npm run batch -- repair <intent-file>` runs the light gate for that fix branch.
- `npm run batch -- publish <intent-file>` opens or updates the batch PR to main from the local batch branch.
- `npm run batch -- resume` reattaches on the branch that owns the reservation. If the daemon reports a decision, use its AXI response command, then resume to record the result. With no reservation, `resume` and `release` report that and exit 0.
- `npm run batch -- release` clears a reservation when a launch never created a run. If the run did start, this command requires a terminal result and records it.
- `npm run batch -- merge <PR>` checks the current head and uses a merge commit.
- `npm run check:light -- <base>` runs the light checks locally. A `batch/<n>` base uses the fetched `origin/batch/<n>` ref.
- `npm run check:full` runs all local checks and the optional root `test:e2e` script.
- `npm run pr:size -- <base> [head]` warns about an authored diff over 1,500 lines.

See the batch gate procedure in `docs/agent-workflow.md`.
