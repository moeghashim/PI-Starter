# Progress Log

Append-only learning log for commits and deploys. Add new entries only at the end of this file. Do not edit or delete previous entries.

## Entry Template

## <ISO timestamp>
- Trigger: <commit|deploy>
- Learning: <required learning>
- Context: <commit message or release bump/version>
- Branch: <branch>
- Actor: <git user.name <git user.email>>
- Changed Paths:
  - <path> (commit entries only)

## 2026-03-04T20:49:52.441Z
- Trigger: commit
- Learning: Established a durable task-memory loop by logging commit/deploy learnings in an append-only progress file and requiring startup review of recent entries.
- Context: feat(agent): add append-only progress learning workflow
- Branch: main
- Actor: Ja3ood <moeghashim@users.noreply.github.com>
- Changed Paths:
  - .codex/prompts/pickup.md
  - .husky/pre-commit
  - AGENTS.md
  - CONTRIBUTING.md
  - README.md
  - docs/agent-workflow.md
  - package.json
  - scripts/agent-check.mjs
  - scripts/release.mjs
  - progress.md
  - scripts/commit-with-progress.mjs
  - scripts/progress-append-only-check.mjs
  - scripts/progress-log.mjs
## 2026-03-04T20:50:00.427Z
- Trigger: deploy
- Learning: Release automation now captures deploy learnings in progress.md and keeps startup context aligned with recent execution history.
- Context: bump=patch; version=0.0.2
- Branch: main
- Actor: Ja3ood <moeghashim@users.noreply.github.com>
## 2026-03-04T22:52:22.880Z
- Trigger: commit
- Learning: Closing the release cycle with an explicit Unreleased bucket keeps the next change set structured and prevents changelog drift.
- Context: chore(release): add [Unreleased] section for next cycle
- Branch: main
- Actor: Ja3ood <moeghashim@users.noreply.github.com>
- Changed Paths:
  - packages/core/CHANGELOG.md
## 2026-03-04T22:52:26.690Z
- Trigger: commit
- Learning: Starter releases should not require registry credentials by default; publish must be explicit to avoid blocked deploy flows.
- Context: feat(release): make npm publish opt-in for starter
- Branch: main
- Actor: Ja3ood <moeghashim@users.noreply.github.com>
- Changed Paths:
  - scripts/release.mjs
  - README.md
  - CONTRIBUTING.md
## 2026-03-22T13:11:46.547Z
- Trigger: commit
- Learning: The starter now defaults to a Vercel-ready app, keeps solo progress logging, and hardens setup against architecture drift and accidental useEffect usage.
- Context: feat(starter): add solo Vercel app workflow
- Branch: main
- Actor: Ja3ood <moeghashim@users.noreply.github.com>
- Changed Paths:
  - .codex/prompts
  - .github/workflows/ci.yml
  - .gitignore
  - AGENTS.md
  - CONTRIBUTING.md
  - README.md
  - biome.json
  - docs
  - package-lock.json
  - package.json
  - scripts
  - .nvmrc
  - apps
## 2026-04-04T00:13:11.982Z
- Trigger: commit
- Learning: Fast-fail native dependency checks and pinned vendored skills keep the starter reliable across darwin-x64, darwin-arm64, and Linux while preserving updateable upstream guidance.
- Context: feat(agent): vendor Vercel skills and add multi-arch preflight
- Branch: main
- Actor: Ja3ood <moeghashim@users.noreply.github.com>
- Changed Paths:
  - .codex/prompts/build-feature.md
  - .codex/prompts/fix.md
  - .codex/prompts/pickup.md
  - .codex/prompts/ship.md
  - AGENTS.md
  - CONTRIBUTING.md
  - README.md
  - agent/manifest.json
  - agent/skills-manifest.json
  - agent/skills
  - docs/README.md
  - docs/agent-skills.md
  - docs/agent-workflow.md
  - docs/deploying-to-vercel.md
  - package.json
  - scripts/agent-check.mjs
  - scripts/agent-sync.mjs
  - scripts/doctor.mjs
  - scripts/docs-list.mjs
  - scripts/native-deps.mjs
  - scripts/preflight-native-deps.mjs
## 2026-04-04T21:35:21.580Z
- Trigger: commit
- Learning: A second pinned skill pack can extend the starter's process rigor without replacing the existing Codex-first workflow when manifests, prompts, docs, and validation are kept source-specific.
- Context: feat(agent): add curated Addy process skill pack
- Branch: main
- Actor: Ja3ood <moeghashim@users.noreply.github.com>
- Changed Paths:
  - agent/skills-manifest.addyosmani.json
  - agent/skills/addyosmani
  - package.json
  - scripts/agent-check.mjs
  - AGENTS.md
  - docs/agent-skills.md
  - docs/agent-workflow.md
  - docs/README.md
  - docs/architecture-decisions.md
  - .codex/prompts/pickup.md
  - .codex/prompts/build-feature.md
  - .codex/prompts/fix.md
  - .codex/prompts/ship.md
  - README.md
## 2026-04-04T21:44:59.731Z
- Trigger: commit
- Learning: Keeping inspiration links inline in the README preserves provenance without expanding the top-level overview.
- Context: docs(readme): add inline upstream links
- Branch: main
- Actor: Ja3ood <moeghashim@users.noreply.github.com>
- Changed Paths:
  - README.md
## 2026-04-08T02:04:33.332Z
- Trigger: commit
- Learning: Husky should install only in local Git workspaces; gating prepare on CI, Vercel, HUSKY=0, and missing .git keeps deploy installs clean without weakening local pre-commit checks.
- Context: chore(husky): skip hook install in deploys
- Branch: main
- Actor: Ja3ood <moeghashim@users.noreply.github.com>
- Changed Paths:
  - package.json
  - scripts/prepare.mjs
## 2026-04-08T02:04:53.989Z
- Trigger: commit
- Learning: Husky should install only in local Git workspaces; gating prepare on CI, Vercel, HUSKY=0, and missing .git keeps deploy installs clean without weakening local pre-commit checks.
- Context: chore(husky): skip hook install in deploys
- Branch: main
- Actor: Ja3ood <moeghashim@users.noreply.github.com>
- Changed Paths:
  - package.json
  - scripts/prepare.mjs
## 2026-04-08T02:13:10.618Z
- Trigger: commit
- Learning: The deployable Next workspace must declare its own TypeScript and Node type dependencies so production installs and Vercel builds succeed when the app is built from its workspace root.
- Context: fix(web): add local TypeScript build deps
- Branch: main
- Actor: Ja3ood <moeghashim@users.noreply.github.com>
- Changed Paths:
  - apps/web/package.json
  - package-lock.json
## 2026-04-17T22:18:55.735Z
- Trigger: commit
- Learning: GitHub Actions should own the required quality gate while Vercel Git integration remains a packaging-only deploy step, with Next type validation skipped only on Vercel builds.
- Context: chore(ci): gate Vercel deploys with GitHub checks
- Branch: codex/github-ci-vercel-gates
- Actor: Ja3ood <moeghashim@users.noreply.github.com>
- Changed Paths:
  - .github/workflows/ci.yml
  - apps/web/next.config.ts
  - docs/deploying-to-vercel.md
