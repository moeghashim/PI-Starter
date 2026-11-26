---
summary: "Deploying the TanStack Start app to hosts other than Vercel and Cloudflare through Nitro presets"
read_when:
  - Adding a host other than Vercel or Cloudflare for `apps/web`.
  - Self-hosting `apps/web` on Node.js, Bun, or a container.
---

# Deploying To Other Hosts

`apps/web` builds with Nitro by default (`npm run build -w @pi-starter/web`). Nitro detects many hosts on its own, including Vercel, Netlify, and Railway, and otherwise follows the `NITRO_PRESET` environment variable. Cloudflare Workers uses Cloudflare's own Vite plugin instead; see `docs/deploying-to-cloudflare.md`.

## Self-Hosting On Node.js

```bash
npm run build -w @pi-starter/web
npm run start -w @pi-starter/web
```

`start` runs `node .output/server/index.mjs`. Set `PORT` to change the listening port.

## Other Presets

Set the preset for the build when the host is not detected automatically, for example:

```bash
NITRO_PRESET=bun npm run build -w @pi-starter/web
```

See the Nitro deploy docs for the preset list and each provider's settings. Nitro 3 is still a release candidate and is pinned to an exact version in `apps/web/package.json`; review its release notes before bumping it.

Before relying on a new host, run its build in CI or locally and smoke-test the output, and follow the database and shipping checks in `docs/deploying-to-vercel.md`.

## References

- [Nitro deploy providers](https://v3.nitro.build/deploy)
- [TanStack Start hosting guide](https://tanstack.com/start/latest/docs/framework/react/guide/hosting)
