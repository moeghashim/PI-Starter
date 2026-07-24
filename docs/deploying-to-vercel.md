---
summary: "Minimal Vercel deployment path for the default Next.js app workspace"
read_when:
  - Setting up the starter on Vercel for the first time.
  - Shipping changes from `apps/web`.
---

# Deploying To Vercel

Use Vercel Git integration as the default deployment path for this starter.

This document remains the canonical PI Starter deployment baseline even if you vendor additional upstream Vercel deployment skills later.

## Project Settings

- Framework preset: Next.js
- Root directory: `apps/web`
- Install command: `npm install`
- Build command: `npm run build`

## Build Quality Gates

Vercel builds are deploy packaging only. When Vercel sets `VERCEL=1`, `apps/web/next.config.ts` skips Next.js production TypeScript validation so type errors do not block deployment after CI has already checked the branch.

Next.js 16 does not run linting during `next build`; keep linting and type checking in CI with `npm run check`.

GitHub Actions owns the required quality gate. The `CI` workflow runs `npm run check`, `npm test`, and `npm run agent:check` on pull requests and pushes to `main`, plus a Fallow new-code audit on pull requests. Protect `main` by requiring the `Required checks` and `Fallow audit` status checks before merge.

## Environment Variables

Start with no extra environment variables unless your app adds them. Configure app-specific secrets in the Vercel project, scoped to `apps/web`.

## Database Deployments

The starter does not prescribe a database provider or migration tool. When a fork adds one, document the project-specific database deploy command near the app code or in this document.

Before shipping `apps/web`, inspect the diff for schema, migration, ORM configuration, seed data, database client, or database environment changes. If any are present, deploy the database changes before or during the app rollout and verify the deployed app is compatible with the deployed database state.

## Solo Shipping Flow

1. Run `npm run check`
2. Run `npm test`
3. Run `npm run fallow:audit`
4. Run `npm run agent:check`
5. Push the committed feature branch with `git push no-mistakes`; the gate validates the branch and opens the pull request. Do not push directly to `origin`.
6. Wait for `Required checks` and `Fallow audit` to pass, then merge to `main`
7. If the change includes database work, run the project-specific database deploy or migration command
8. Let Vercel Git integration build and deploy `apps/web`
9. Verify the deployed app and database are compatible

This starter does not require a custom `vercel.json`.
