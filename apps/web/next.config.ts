import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const appDir = dirname(fileURLToPath(import.meta.url));
const isDeployPackagingBuild = process.env.VERCEL === "1" || process.env.WORKERS_CI === "1";

const nextConfig: NextConfig = {
	reactStrictMode: true,
	typescript: {
		ignoreBuildErrors: isDeployPackagingBuild,
	},
	turbopack: {
		root: join(appDir, "../.."),
	},
};

export default nextConfig;
