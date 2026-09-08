---
summary: "Cloudflare Workers deployment path for the default Next.js app workspace"
read_when:
  - Setting up the starter on Cloudflare for the first time.
  - Choosing between Vercel and Cloudflare Workers for `apps/web`.
  - Shipping `apps/web` through Workers Builds or Wrangler.
---

# Deploying To Cloudflare

Use Cloudflare Workers with the OpenNext adapter for the default Next.js app.

## Hosting Selection

Choose exactly one default host for a fork:

- Vercel: follow `docs/deploying-to-vercel.md` and use Vercel Git integration.
- Cloudflare: follow this document and use Workers Builds or Wrangler.

The provider commands remain separate so the choice is reversible:

- Vercel build command: `npm run build`
- Cloudflare deploy command: `npm run deploy:cloudflare`
- Cloudflare preview command: `npm run preview:cloudflare`
- Cloudflare build-only command: `npm run build:cloudflare`

There is intentionally no generic root `deploy` script.

## Project Settings

Cloudflare Workers Builds should run from the repository root so npm workspaces and the root lockfile are available.

- Product: Workers
- Root directory: repository root
- Install command: `npm ci`
- Deploy command: `npm run deploy:cloudflare`
- Worker configuration: `apps/web/wrangler.jsonc`

The Worker name configured in the Cloudflare dashboard must match `pi-starter-web` from `apps/web/wrangler.jsonc`. Forks should rename both together.

The Wrangler configuration points Workers at the OpenNext worker and static assets, enables `nodejs_compat`, and enables observability. `apps/web/open-next.config.ts` holds adapter-specific configuration.

## Local Commands

Use the normal Next.js server for daily development:

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

Regenerate binding types after changing `apps/web/wrangler.jsonc`:

```bash
npm run typegen:cloudflare
```

`npm run typegen:cloudflare` runs `apps/web/scripts/cloudflare-typegen.mjs`, which generates `apps/web/cloudflare-env.d.ts` through the Wrangler type-generation API from the bindings in `apps/web/wrangler.jsonc` while ignoring the `main` entrypoint. Plain `wrangler types` would embed a `GlobalProps` import of the gitignored `.open-next/worker.js` whenever build output exists, so the wrapper keeps the committed file identical whether or not `npm run build:cloudflare` or `npm run preview:cloudflare` ran first. The wrapper also generates from an isolated temporary copy of the config with Wrangler's `.env` and `process.env` secret inference disabled, so local `.dev.vars`, `.env`, and shell secrets never appear in the committed file; only bindings and `vars` declared in `apps/web/wrangler.jsonc` are typed. `npm test` regenerates the types with and without build output, with synthetic `.dev.vars`, `.env`, and process-environment secrets, and with fixture bindings and `vars`, and fails when the output differs, imports build output, leaks a secret name, drops a declared binding, or drifts from the committed file.

The generated `apps/web/cloudflare-env.d.ts` omits runtime types, so binding names such as `Fetcher`, `KVNamespace`, and `D1Database` resolve through `@cloudflare/workers-types`, which `apps/web/tsconfig.json` lists in `types` and `apps/web/package.json` pins alongside Wrangler. The `compatibility_date` in `apps/web/wrangler.jsonc` matches the `workerd` release bundled with the pinned Wrangler, so local preview runs the same runtime baseline as production. Bump Wrangler, `@cloudflare/workers-types`, and `compatibility_date` together when moving to a newer runtime baseline.

## Build Quality Gates

Cloudflare deploys are packaging steps. Workers Builds automatically sets `WORKERS_CI=1`, so `apps/web/next.config.ts` skips duplicate production TypeScript validation after GitHub Actions has checked the branch.

Next.js does not run repository linting during `next build`. Keep formatting, linting, types, tests, agent checks, and Fallow auditing in the repository validation flow.

CI builds the OpenNext Worker on Ubuntu with `npm run build:cloudflare`; this does not deploy or require Cloudflare credentials. Protect `main` by requiring `Required checks`, `Fallow audit`, and `Cloudflare build` before merge. The packaging check does not replace local Workers-runtime preview when changing runtime behavior.

## Environment Variables And Bindings

Configure build-time variables and secrets in Workers Builds. Configure runtime variables, secrets, and bindings on the Worker.

Start with no additional bindings. After adding D1, KV, R2, Queues, Durable Objects, or service bindings, update `apps/web/wrangler.jsonc` and run `npm run typegen:cloudflare`.

## Database Deployments

The starter does not prescribe a database provider or migration tool. When a fork adds one, document the project-specific deployment command.

Before shipping `apps/web`, inspect the diff for schema, migration, ORM configuration, seed data, database client, or database environment changes. Deploy database changes before or during the app rollout and verify compatibility.

## Solo Shipping Flow

1. Run `npm run check`
2. Run `npm test`
3. Run `npm run fallow:audit`
4. Run `npm run agent:check`
5. Push the committed feature branch with `git push no-mistakes`
6. Wait for `Required checks`, `Fallow audit`, and `Cloudflare build`, then merge to `main`
7. Run any required database deployment
8. Let Workers Builds run `npm run deploy:cloudflare`, or deploy manually
9. Verify the deployed app and database are compatible

## References

- [Cloudflare Next.js guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [OpenNext Cloudflare adapter](https://opennext.js.org/cloudflare)
- [Cloudflare Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/)
