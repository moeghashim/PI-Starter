import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const webRoot = join(root, "apps/web");
const typegenScript = join(webRoot, "scripts/cloudflare-typegen.mjs");
const ISOLATED_CONFIG_PREFIX = "pi-cloudflare-typegen-config-";

function generate(directory, outputName, extraEnv = {}) {
	const outputPath = join(directory, outputName);
	execFileSync(
		process.execPath,
		[typegenScript, "--config", join(directory, "wrangler.jsonc"), "--output", outputPath],
		{
			cwd: webRoot,
			env: { ...process.env, WRANGLER_SEND_METRICS: "false", ...extraEnv },
			stdio: ["ignore", "pipe", "pipe"],
		},
	);
	return readFileSync(outputPath, "utf8");
}

function createFixtureDirectory(t) {
	const directory = mkdtempSync(join(tmpdir(), "pi-cloudflare-typegen-"));
	t.after(() => rmSync(directory, { recursive: true, force: true }));
	return directory;
}

function listIsolatedConfigDirectories() {
	return readdirSync(tmpdir()).filter((name) => name.startsWith(ISOLATED_CONFIG_PREFIX));
}

test("cloudflare typegen output is identical with and without OpenNext build output", (t) => {
	const directory = createFixtureDirectory(t);
	copyFileSync(join(webRoot, "wrangler.jsonc"), join(directory, "wrangler.jsonc"));
	const isolatedDirectoriesBefore = listIsolatedConfigDirectories();

	const withoutBuildOutput = generate(directory, "without-build.d.ts");

	mkdirSync(join(directory, ".open-next"), { recursive: true });
	writeFileSync(
		join(directory, ".open-next/worker.js"),
		'export default { fetch() { return new Response("ok"); } };\n',
	);
	const withBuildOutput = generate(directory, "with-build.d.ts");

	assert.equal(withBuildOutput, withoutBuildOutput);
	assert.doesNotMatch(withoutBuildOutput, /import\(/);
	assert.doesNotMatch(withoutBuildOutput, /GlobalProps/);
	assert.match(withoutBuildOutput, /ASSETS: Fetcher;/);
	assert.match(withoutBuildOutput, /interface CloudflareEnv extends __BaseEnv_CloudflareEnv \{\}/);
	assert.equal(withoutBuildOutput, readFileSync(join(webRoot, "cloudflare-env.d.ts"), "utf8"));
	assert.deepEqual(readdirSync(directory).sort(), [
		".open-next",
		"with-build.d.ts",
		"without-build.d.ts",
		"wrangler.jsonc",
	]);
	assert.deepEqual(listIsolatedConfigDirectories(), isolatedDirectoriesBefore);
});

test("cloudflare typegen ignores local secret files and process environment", (t) => {
	const directory = createFixtureDirectory(t);
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
	const directory = createFixtureDirectory(t);
	writeFileSync(
		join(directory, "wrangler.jsonc"),
		JSON.stringify({
			name: "pi-starter-web-fixture",
			main: ".open-next/worker.js",
			compatibility_date: "2026-07-22",
			assets: { directory: ".open-next/assets", binding: "ASSETS" },
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
