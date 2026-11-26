import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

// One app, many hosts. `vite build --mode cloudflare` targets Cloudflare Workers through Cloudflare's
// Vite plugin. Every other build uses Nitro, which detects Vercel, Netlify, and other hosts on its own,
// or follows NITRO_PRESET (for example `node-server` or `bun`).
export default defineConfig(({ mode }) => {
	const cloudflareBuild = mode === "cloudflare";
	return {
		resolve: { tsconfigPaths: true },
		plugins: [
			...(cloudflareBuild ? [cloudflare({ viteEnvironment: { name: "ssr" } })] : []),
			tanstackStart(),
			...(cloudflareBuild ? [] : [nitro()]),
			// React's plugin must come after Start's.
			viteReact(),
		],
	};
});
