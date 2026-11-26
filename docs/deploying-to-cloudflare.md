---
summary: "Cloudflare Workers deployment path for the TanStack Start app workspace"
read_when:
  - Setting up the starter on Cloudflare for the first time.
  - Choosing or adding hosts for `apps/web`.
  - Shipping `apps/web` through Workers Builds or Wrangler.
---

# Deploying To Cloudflare

Deploy `apps/web` to Cloudflare Workers with Cloudflare's Vite plugin, the officially supported path for TanStack Start. `vite build --mode cloudflare` selects that plugin in `apps/web/vite.config.ts`; other builds use Nitro.

The same app can deploy to Cloudflare, Vercel (`docs/deploying-to-vercel.md`), and other hosts (`docs/deploying-to-other-hosts.md`) at the same time. The Cloudflare commands are:

- Deploy: `npm run deploy:cloudflare`
- Preview in the Workers runtime: `npm run preview:cloudflare`
- Build only: `npm run build:cloudflare`

There is intentionally no generic root `deploy` script.

## Project Settings

Cloudflare Workers Builds should run from the repository root so npm workspaces and the root lockfile are available.

- Product: Workers
- Root directory: repository root
- Install command: `npm ci`
- Deploy command: `npm run deploy:cloudflare`
- Worker configuration: `apps/web/wrangler.jsonc`

The Worker name configured in the Cloudflare dashboard must match `pi-starter-web` from `apps/web/wrangler.jsonc`. Forks should rename both together.

`apps/web/wrangler.jsonc` points Workers at TanStack Start's server entry, enables `nodejs_compat`, and enables observability. The Vite plugin writes the deployable Worker and its static assets to `apps/web/dist` and generates the configuration `wrangler deploy` reads, so do not pass `--config` to it. For named Wrangler environments, set `CLOUDFLARE_ENV` at build time instead of using `wrangler deploy --env`.

## Local Commands

Use the Vite dev server for daily development:

```bash
npm run dev -w @pi-starter/web
```

Preview the production bundle in the Workers runtime before relying on Worker-specific behavior:

```bash
npm run preview:cloudflare
```

Deploy manually when Workers Builds is not responsible for deployment:

```bash
npm run deploy:cloudflare
```

Regenerate binding and runtime types after changing `apps/web/wrangler.jsonc` or upgrading Wrangler:

```bash
npm run typegen:cloudflare
```

`npm run typegen:cloudflare` writes `apps/web/cloudflare-env.d.ts`. Commit the generated file so `npm run check` works on a fresh checkout. Wrangler reads binding declarations from the config and generates runtime types from the Worker's compatibility date and flags. The web TypeScript project includes the generated file, so Worker code can use `CloudflareEnv` and binding types such as `KVNamespace` and `D1Database`. The tooling project loads Node globals separately. Use Worker bindings only in code that runs on Cloudflare.

The wrapper generates from an isolated temporary config. It drops the `main` entrypoint so adding build output does not create a `GlobalProps` import. It also disables secret inference from local `.dev.vars`, `.env`, and the shell environment. Tests check output stability and secret isolation. They compile a KV and D1 fixture with the web TypeScript config and verify that `process` and `Buffer` stay out of app scope. Test changes to the compatibility date or flags in Workers preview.

## Build Quality Gates

Cloudflare deploys are packaging steps. `vite build` does not type-check or lint; keep formatting, linting, types, tests, agent checks, and Fallow auditing in the repository validation flow.

CI's `Web builds` job runs `npm run build:cloudflare` on Ubuntu; this does not deploy or require Cloudflare credentials. Protect `main` by requiring `Required checks` and `DCO` before merge; `Required checks` aggregates the validation, web build, and Fallow jobs. The packaging check does not replace local Workers-runtime preview when changing runtime behavior.

## Environment Variables And Bindings

Configure build-time variables and secrets in Workers Builds. Configure runtime variables, secrets, and bindings on the Worker.

Start with no additional bindings. After adding D1, KV, R2, Queues, Durable Objects, or service bindings, update `apps/web/wrangler.jsonc` and run `npm run typegen:cloudflare`.

## Database Deployments

The starter does not prescribe a database provider or migration tool. When a fork adds one, document the project-specific deployment command.

Before shipping `apps/web`, inspect the diff for schema, migration, ORM configuration, seed data, database client, or database environment changes. Deploy database changes before or during the app rollout and verify compatibility.

## Solo Shipping Flow

1. Run the validation steps in `docs/agent-workflow.md`
2. Push the committed feature branch to `origin` and open a GitHub pull request
3. Wait for `Required checks` and `DCO` to pass, then merge to `main`
4. Run any required database deployment
5. Let Workers Builds run `npm run deploy:cloudflare`, or deploy manually
6. Verify the deployed app and database are compatible

## References

- [Cloudflare TanStack Start guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/)
- [TanStack Start hosting guide](https://tanstack.com/start/latest/docs/framework/react/guide/hosting)
- [Cloudflare Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/)
