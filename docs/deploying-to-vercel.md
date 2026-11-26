---
summary: "Vercel deployment path for the TanStack Start app workspace, built through Nitro"
read_when:
  - Setting up the starter on Vercel for the first time.
  - Choosing or adding hosts for `apps/web`.
  - Shipping changes from `apps/web`.
---

# Deploying To Vercel

Deploy `apps/web` with Vercel Git integration. The app is TanStack Start built with Vite; its default build uses Nitro, which detects Vercel and writes Vercel's Build Output API. No `vercel.json` is needed.

The same app can deploy to Vercel, Cloudflare Workers (`docs/deploying-to-cloudflare.md`), and other hosts (`docs/deploying-to-other-hosts.md`) at the same time. Each host runs its own build; there is intentionally no generic root `deploy` script.

## Project Settings

- Framework preset: detected automatically (TanStack Start with Nitro)
- Root directory: `apps/web`
- Install command: `npm install`
- Build command: `npm run build`

## Build Quality Gates

Vercel builds are deploy packaging only. `vite build` does not type-check or lint; GitHub Actions owns those through `npm run check`, `npm test`, `npm run agent:check`, and a Fallow audit on pull requests. CI also runs `npm run build -w @pi-starter/web`, the same Nitro build Vercel runs.

Protect `main` by requiring `Required checks` and `DCO` before merge; `Required checks` aggregates the validation, web build, and Fallow jobs.

## Environment Variables

Start with no extra environment variables unless your app adds them. Configure app-specific secrets in the Vercel project, scoped to `apps/web`.

## Database Deployments

The starter does not prescribe a database provider or migration tool. When a fork adds one, document the project-specific database deploy command near the app code or in this document.

Before shipping `apps/web`, inspect the diff for schema, migration, ORM configuration, seed data, database client, or database environment changes. If any are present, deploy the database changes before or during the app rollout and verify the deployed app is compatible with the deployed database state.

## Solo Shipping Flow

1. Run the validation steps in `docs/agent-workflow.md`
2. Push the committed feature branch to `origin` and open a GitHub pull request.
3. Wait for `Required checks` and `DCO` to pass, then merge to `main`
4. If the change includes database work, run the project-specific database deploy or migration command
5. Let Vercel Git integration build and deploy `apps/web`
6. Verify the deployed app and database are compatible

## References

- [TanStack Start on Vercel](https://vercel.com/docs/frameworks/full-stack/tanstack-start)
- [TanStack Start hosting guide](https://tanstack.com/start/latest/docs/framework/react/guide/hosting)
