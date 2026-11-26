---
summary: "Replace Next.js with TanStack Start so one app deploys to Vercel, Cloudflare Workers, and other hosts"
read_when:
  - Changing the `apps/web` framework or its build.
  - Adding or changing a host for `apps/web`.
  - Re-evaluating Next.js, OpenNext, Nitro, or Cloudflare's Vite plugin.
---

# TanStack Start Web Framework

## Status

Accepted. Supersedes `docs/adrs/2026-07-27-cloudflare-workers-hosting-option.md`.

## Context

The starter should host `apps/web` on Vercel and Cloudflare Workers at once, and possibly on more hosts later. With Next.js, Cloudflare needed the OpenNext adapter: a second build, adapter configuration, a type-generation workaround for its Worker output, and a security override for a transitive dependency. Next.js also pinned the web app to TypeScript 5.9 while the rest of the repo moved to TypeScript 7.

## Decision

Build `apps/web` with TanStack Start on Vite.

- `vite build --mode cloudflare` uses Cloudflare's Vite plugin, the officially supported path for Workers, with `apps/web/wrangler.jsonc` pointing at TanStack Start's server entry.
- Every other build uses Nitro. Nitro detects Vercel, Netlify, and other hosts on its own and follows `NITRO_PRESET` otherwise; plain builds produce a Node server.
- CI builds both outputs on every pull request. Shared app code has browser types. The Vite config and Node tests use a separate TypeScript project.
- The generated route tree (`apps/web/src/routeTree.gen.ts`) is committed so type checks and Fallow work on a clean checkout without a build step.

## Consequences

One app deploys to several hosts without per-host adapters. The repo runs a single TypeScript 7 toolchain, the OpenNext adapter, its configuration, and the related npm override are gone, and `npm run check` no longer needs a framework type-generation step.

Nitro 3 is a release candidate, so it is pinned to an exact version; Vercel and other Nitro hosts depend on it, while Cloudflare does not. Vercel no longer runs its own framework, so Vercel-specific Next.js features are unavailable. Parts of the vendored Vercel skill pack describe Next.js APIs; the React guidance still applies, and the Next.js-specific rules do not.

## Alternatives Considered

- Keep Next.js with OpenNext for Cloudflare: works, but keeps a second build path, an adapter, and the TypeScript 5.9 pin.
- Nitro's Cloudflare preset instead of Cloudflare's Vite plugin: one build tool for every host, but not the path TanStack and Cloudflare document as supported for Workers.
