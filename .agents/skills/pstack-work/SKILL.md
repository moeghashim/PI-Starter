---
name: pstack-work
description: Use for a feature, bug fix, refactor, or measured performance change in PI-Starter. Use portable PStack guidance to verify the behavior through the normal entry point before PR handoff.
---

# Develop with PStack

Read the repository rules and the smallest set of skills needed for the change.

1. For a feature, use `build-feature` and `principle-sequence-verifiable-units`. Start with one small end-to-end change.
2. For a bug, use `fix` and `principle-fix-root-causes`. Reproduce the failure before changing behavior.
3. For a refactor, record the behavior to preserve and check it in each small step.
4. For performance work, use `performance-optimization` and `principle-explain-the-number`. Measure a baseline, change one thing at a time, and measure again under the same conditions.

When adding a test, use `principle-test-behavior-not-implementation`. Before handoff, use `principle-prove-it-works` through the normal entry point. Record the scenario tested, the result, and any checks you could not run.

Use the host's normal shell, browser, and review tools. If delegation is authorized and available, give an independent reviewer the exact diff and verification evidence. If it is unavailable, report that gap. Use GitHub CLI for PR operations. Cursor-specific automation, cloud agents, and Bugbot setup require their own integration. Review comments already on GitHub remain visible through GitHub CLI.

Follow the validation and PR publication rules in `docs/agent-workflow.md`. Use TStack for PR review and handoff.
