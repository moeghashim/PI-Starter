---
summary: "Minimal Vercel deployment path for the default Next.js app workspace"
read_when:
  - Setting up the starter on Vercel for the first time.
  - Choosing between Vercel and Cloudflare Workers for `apps/web`.
  - Shipping changes from `apps/web`.
---

# Deploying To Vercel

Use Vercel Git integration as the default deployment path for this starter.

This document remains the canonical PI Starter Vercel deployment baseline even if you vendor additional upstream Vercel deployment skills later.

For Cloudflare Workers hosting, use `docs/deploying-to-cloudflare.md` instead. The provider paths remain intentionally separate.

## Hosting Selection

Choose exactly one default host for a fork:

- Vercel: follow this document and keep Vercel Git integration responsible for deploy packaging.
- Cloudflare: follow `docs/deploying-to-cloudflare.md` and keep Workers Builds or Wrangler responsible for deploy packaging.

There is intentionally no generic root `deploy` script. Do not point Vercel at Cloudflare commands or Cloudflare at Vercel project settings.

## Project Settings

- Framework preset: Next.js
- Root directory: `apps/web`
- Install command: `npm install`
- Build command: `npm run build`

## Build Quality Gates

Vercel builds are deploy packaging only. When Vercel sets `VERCEL=1`, `apps/web/next.config.ts` skips Next.js production TypeScript validation so type errors do not block deployment after CI has already checked the branch.

Next.js 16 does not run linting during `next build`; keep linting and type checking in CI with `npm run check`.

Image optimization uses the patched Sharp range declared by Next.js itself; no Next.js-specific Sharp override is needed. See the Dependency Overrides section in `CONTRIBUTING.md` for the current override policy.

GitHub Actions owns the required quality gate. The `CI` workflow runs `npm run check`, `npm test`, and `npm run agent:check` on pull requests and pushes to `main`, runs `npm run agent:verify-upstream` on the Ubuntu runner, plus a Fallow new-code audit on pull requests. It also runs the `Cloudflare build` packaging job so the Cloudflare path stays buildable; Protect `main` by requiring `Required checks` and `DCO` before merge; `Required checks` already aggregates `Cloudflare build` and `Fallow audit`.

## Environment Variables

Start with no extra environment variables unless your app adds them. Configure app-specific secrets in the Vercel project, scoped to `apps/web`.

## Database Deployments

The starter does not prescribe a database provider or migration tool. When a fork adds one, document the project-specific database deploy command near the app code or in this document.

Before shipping `apps/web`, inspect the diff for schema, migration, ORM configuration, seed data, database client, or database environment changes. If any are present, deploy the database changes before or during the app rollout and verify the deployed app is compatible with the deployed database state.

## Solo Shipping Flow

1. Run the validation steps in `docs/agent-workflow.md`
2. Push the committed feature branch with `git push no-mistakes`; the gate validates the branch and opens the pull request. Do not push directly to `origin`.
3. Wait for `Required checks` and `DCO` to pass, then merge to `main`
4. If the change includes database work, run the project-specific database deploy or migration command
5. Let Vercel Git integration build and deploy `apps/web`
6. Verify the deployed app and database are compatible

This starter does not require a custom `vercel.json`.

The Cloudflare-specific `apps/web/wrangler.jsonc` and `apps/web/open-next.config.ts` files are not used by Vercel.
