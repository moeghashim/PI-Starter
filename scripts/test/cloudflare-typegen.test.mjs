import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { root, tempDir } from "./helpers.mjs";

const webRoot = join(root, "apps/web");
const typegenScript = join(webRoot, "scripts/cloudflare-typegen.mjs");
const FIXTURE_TMP_DIRECTORY = "tmp";

function generate(directory, outputName, extraEnv = {}) {
	const outputPath = join(directory, outputName);
	const fixtureTmpDirectory = join(directory, FIXTURE_TMP_DIRECTORY);
	mkdirSync(fixtureTmpDirectory, { recursive: true });
	execFileSync(
		process.execPath,
		[typegenScript, "--config", join(directory, "wrangler.jsonc"), "--output", outputPath],
		{
			cwd: webRoot,
			env: { ...process.env, TMPDIR: fixtureTmpDirectory, WRANGLER_SEND_METRICS: "false", ...extraEnv },
			stdio: ["ignore", "pipe", "pipe"],
		},
	);
	return readFileSync(outputPath, "utf8");
}

test("cloudflare typegen output is identical with and without a built Worker entry", (t) => {
	const directory = tempDir(t, "pi-cloudflare-typegen-");
	// Point the real config at a local Worker entry, so wrangler would import it whenever the file exists.
	const config = readFileSync(join(webRoot, "wrangler.jsonc"), "utf8");
	writeFileSync(
		join(directory, "wrangler.jsonc"),
		config.replace(/"main": "[^"]+"/, '"main": "dist/server/index.js"'),
	);

	const withoutBuildOutput = generate(directory, "without-build.d.ts");

	mkdirSync(join(directory, "dist/server"), { recursive: true });
	writeFileSync(
		join(directory, "dist/server/index.js"),
		'export default { fetch() { return new Response("ok"); } };\n',
	);
	const withBuildOutput = generate(directory, "with-build.d.ts");

	assert.equal(withBuildOutput, withoutBuildOutput);
	const bindings = withoutBuildOutput.split("// Begin runtime types")[0];
	assert.doesNotMatch(bindings, /import\(/);
	assert.doesNotMatch(bindings, /GlobalProps/);
	assert.match(withoutBuildOutput, /interface CloudflareEnv extends __BaseEnv_CloudflareEnv \{\}/);
	assert.equal(withoutBuildOutput, readFileSync(join(webRoot, "cloudflare-env.d.ts"), "utf8"));
	assert.deepEqual(readdirSync(directory).sort(), [
		"dist",
		FIXTURE_TMP_DIRECTORY,
		"with-build.d.ts",
		"without-build.d.ts",
		"wrangler.jsonc",
	]);
	assert.deepEqual(readdirSync(join(directory, FIXTURE_TMP_DIRECTORY)), []);
});

test("cloudflare typegen ignores local secret files and process environment", (t) => {
	const directory = tempDir(t, "pi-cloudflare-typegen-");
	copyFileSync(join(webRoot, "wrangler.jsonc"), join(directory, "wrangler.jsonc"));
	const baseline = generate(directory, "baseline.d.ts");

	writeFileSync(join(directory, ".dev.vars"), "FIXTURE_DEV_VARS_SECRET=synthetic-dev-vars\n");
	const withDevVars = generate(directory, "with-dev-vars.d.ts");
	rmSync(join(directory, ".dev.vars"));

	writeFileSync(join(directory, ".env"), "FIXTURE_DOTENV_SECRET=synthetic-dotenv\n");
	writeFileSync(join(directory, ".env.local"), "FIXTURE_DOTENV_LOCAL_SECRET=synthetic-dotenv-local\n");
	const withDotEnv = generate(directory, "with-dotenv.d.ts", {
		CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "true",
	});

	const withProcessEnv = generate(directory, "with-process-env.d.ts", {
		CLOUDFLARE_INCLUDE_PROCESS_ENV: "true",
		CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "true",
		FIXTURE_PROCESS_SECRET: "synthetic-process-env",
	});

	for (const output of [withDevVars, withDotEnv, withProcessEnv]) {
		assert.equal(output, baseline);
		assert.doesNotMatch(output, /FIXTURE_/);
		assert.doesNotMatch(output, /ProcessEnv/);
	}
});

test("cloudflare typegen keeps bindings and vars declared in wrangler config", (t) => {
	const directory = tempDir(t, "pi-cloudflare-typegen-");
	writeFileSync(
		join(directory, "wrangler.jsonc"),
		JSON.stringify({
			name: "pi-starter-web-fixture",
			main: "dist/server/index.js",
			compatibility_date: "2026-07-22",
			assets: { directory: "dist/client", binding: "ASSETS" },
			vars: { FIXTURE_CONFIG_VAR: "from-config" },
			kv_namespaces: [{ binding: "FIXTURE_KV", id: "00000000000000000000000000000000" }],
		}),
	);
	writeFileSync(join(directory, ".dev.vars"), "FIXTURE_DEV_VARS_SECRET=synthetic-dev-vars\n");

	const output = generate(directory, "with-config-vars.d.ts");

	assert.match(output, /ASSETS: Fetcher;/);
	assert.match(output, /FIXTURE_KV: KVNamespace;/);
	assert.match(output, /FIXTURE_CONFIG_VAR: "from-config";/);
	assert.doesNotMatch(output, /FIXTURE_DEV_VARS_SECRET/);
});

test("web TypeScript resolves generated KV and D1 bindings without Node globals", (t) => {
	const directory = tempDir(t, "pi-cloudflare-typegen-");
	const fixtureWebRoot = join(directory, "apps/web");
	mkdirSync(join(fixtureWebRoot, "src"), { recursive: true });
	symlinkSync(join(root, "node_modules"), join(directory, "node_modules"), "junction");
	copyFileSync(join(root, "tsconfig.base.json"), join(directory, "tsconfig.base.json"));
	copyFileSync(join(webRoot, "tsconfig.json"), join(fixtureWebRoot, "tsconfig.json"));
	writeFileSync(
		join(fixtureWebRoot, "wrangler.jsonc"),
		JSON.stringify({
			name: "pi-starter-web-fixture",
			compatibility_date: "2026-07-22",
			compatibility_flags: ["nodejs_compat"],
			kv_namespaces: [{ binding: "CACHE", id: "00000000000000000000000000000000" }],
			d1_databases: [
				{
					binding: "DB",
					database_name: "fixture-db",
					database_id: "00000000-0000-0000-0000-000000000000",
				},
			],
		}),
	);
	generate(fixtureWebRoot, "cloudflare-env.d.ts");
	writeFileSync(
		join(fixtureWebRoot, "src/bindings.ts"),
		`export async function readBindings(env: CloudflareEnv) {
	const cache: KVNamespace = env.CACHE;
	const db: D1Database = env.DB;
	const value: string | null = await env.CACHE.get("key");
	const row = await env.DB.prepare("SELECT 1").first<number>();
	// @ts-expect-error KV keys must be strings.
	env.CACHE.get(123);
	// @ts-expect-error D1 statements must be SQL strings.
	env.DB.prepare(123);
	return { cache, db, value, row };
}
// @ts-expect-error Shared app code has no ambient Node process.
void process;
// @ts-expect-error Shared app code has no ambient Node Buffer.
void Buffer;
`,
	);
	execFileSync(process.execPath, [join(root, "node_modules/typescript/bin/tsc"), "-p", "tsconfig.json"], {
		cwd: fixtureWebRoot,
		encoding: "utf8",
	});
});
