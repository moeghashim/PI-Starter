---
summary: "Adopt Cloudflare Workers with OpenNext as a second supported hosting path"
read_when:
  - Changing the `apps/web` deployment strategy.
  - Re-evaluating Vercel and Cloudflare hosting support.
  - Adding provider-specific runtime bindings or deploy commands.
---

# Cloudflare Workers Hosting Option

## Status

Accepted

## Context

PI Starter began as a Vercel-ready Next.js starter. Forks should also be able to choose Cloudflare without converting the app to a static export or replacing Next.js with a Worker-native framework.

Cloudflare's Next.js guidance uses Workers with the OpenNext adapter for full-stack applications. That preserves the standard Next.js runtime features while producing a Worker-compatible bundle.

## Decision

Support Cloudflare as a second hosting option through `@opennextjs/cloudflare`, Wrangler, `apps/web/wrangler.jsonc`, and `apps/web/open-next.config.ts`.

Keep provider selection explicit:

- Vercel uses Vercel Git integration and `npm run build`.
- Cloudflare uses Workers Builds or Wrangler and `npm run deploy:cloudflare`.

Provider-specific runtime configuration belongs in provider-specific files. Shared Next.js application code should not need to change when a fork chooses Vercel or Cloudflare.

## Consequences

Forks can choose Vercel or Cloudflare through project settings and deploy commands rather than an application rewrite.

The web workspace carries the OpenNext adapter and Wrangler as deployment tooling. Cloudflare-specific bindings such as D1, KV, R2, Queues, Durable Objects, or service bindings remain opt-in. Adding one requires a deliberate Wrangler configuration change and regenerated binding types.

GitHub Actions remains the quality gate. Provider builds package already-validated code and may skip Next.js production type validation when the provider marks the build as deployment packaging.

## Alternatives Considered

- Cloudflare Pages: rejected as the default Cloudflare path because Workers with OpenNext preserve the full-stack Next.js runtime.
- Wrangler auto-detection only: rejected because reusable starters benefit from discoverable, reviewable deployment configuration.
- A generic root `deploy` script: rejected because it would make provider selection ambiguous.
