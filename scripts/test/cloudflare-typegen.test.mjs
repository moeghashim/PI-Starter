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

function generate(directory, outputName) {
	const outputPath = join(directory, outputName);
	execFileSync(
		process.execPath,
		[typegenScript, "--config", join(directory, "wrangler.jsonc"), "--output", outputPath],
		{
			cwd: webRoot,
			env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
			stdio: ["ignore", "pipe", "pipe"],
		},
	);
	return readFileSync(outputPath, "utf8");
}

test("cloudflare typegen output is identical with and without OpenNext build output", (t) => {
	const directory = mkdtempSync(join(tmpdir(), "pi-cloudflare-typegen-"));
	t.after(() => rmSync(directory, { recursive: true, force: true }));
	copyFileSync(join(webRoot, "wrangler.jsonc"), join(directory, "wrangler.jsonc"));

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
	assert.deepEqual(
		readdirSync(directory).filter((name) => name.startsWith(".wrangler-typegen-")),
		[],
	);
});
