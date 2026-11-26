---
summary: "Index of the local workflow skills stored in this repository"
read_when:
  - Looking up the in-repo workflow skills.
  - Updating the workflows for pickup, handoff, feature delivery, fixes, or solo shipping.
---

# Workflow Skill Index

Local workflow skills are stored under `.agents/skills/<name>/SKILL.md`, next to the vendored packs described in `docs/agent-skills.md`. `.claude/skills` is a symlink to the same directory, so harnesses that read either location discover them as slash commands.

- `/pickup`: Session rehydration checklist before starting work.
- `/handoff`: Structured handoff notes for the next agent.
- `/build-feature`: Tracer-bullet workflow for net-new features, starting with one tiny end-to-end slice.
- `/fix`: End-to-end issue fix workflow with tests and checks.
- `/pstack-work` guides development and verification across agent hosts.
- `/full-stop` runs the TStack PR workflow and leaves the PR open. Follow the repository rules in `docs/agent-workflow.md`.
- `/ship` guides solo app deployment or package release. Invoke it explicitly.
- `npm run pr:size -- origin/main` reports authored changed lines and warns above 1,500.

TStack skills are vendored. Edit their manifest to update them. The repository owns the other workflow skills listed here.
