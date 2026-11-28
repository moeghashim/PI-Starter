import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { sandbox } from "./helpers.mjs";

test("init:project renames starter identifiers and appends a fork boundary to progress.md", (t) => {
	const s = sandbox(t);
	s.copy("scripts/init-project.mjs");
	s.copy("scripts/progress-log.mjs");
	s.write("progress.md", "# Progress Log\n");
	s.write(
		"package.json",
		JSON.stringify({ name: "pi-starter", scripts: { dev: "pnpm --filter @pi-starter/web dev" } }),
	);
	s.write("packages/core/package.json", JSON.stringify({ name: "@pi-starter/core", version: "0.0.2" }));
	s.write(
		"apps/web/package.json",
		JSON.stringify({ name: "@pi-starter/web", dependencies: { "@pi-starter/core": "workspace:^" } }),
	);
	s.write(
		"tsconfig.json",
		JSON.stringify({ compilerOptions: { paths: { "@pi-starter/*": ["./packages/*/src/index.ts"] } } }),
	);
	s.write(
		"apps/web/tsconfig.json",
		JSON.stringify({ compilerOptions: { paths: { "@pi-starter/core": ["../../packages/core/src/index.ts"] } } }),
	);
	s.write("apps/web/wrangler.jsonc", '{"name": "pi-starter-web"}\n');
	s.write("apps/web/src/routes/__root.tsx", 'const head = { title: "PI-Starter" };\n');
	s.write(
		"apps/web/src/routes/index.tsx",
		'import { hello } from "@pi-starter/core";\nexport const label = hello("PI-Starter");\n',
	);
	s.write("apps/web/test/home.test.ts", "assert.match(html, /Hello, PI-Starter!/);\n");
	s.write(".github/workflows/ci.yml", "run: pnpm --filter @pi-starter/web run build\n");
	s.run("git", ["add", "."]);
	s.run("git", ["commit", "-q", "-m", "fixture"]);

	const result = s.node("scripts/init-project.mjs", "--name", "acme-cloud", "--title", "Acme Cloud");
	assert.equal(result.status, 0, result.stderr);

	assert.equal(JSON.parse(readFileSync(join(s.directory, "package.json"), "utf8")).name, "acme-cloud");
	assert.match(readFileSync(join(s.directory, "package.json"), "utf8"), /@acme-cloud\/web/);
	assert.equal(
		JSON.parse(readFileSync(join(s.directory, "packages/core/package.json"), "utf8")).name,
		"@acme-cloud/core",
	);
	assert.equal(JSON.parse(readFileSync(join(s.directory, "apps/web/package.json"), "utf8")).name, "@acme-cloud/web");
	assert.match(readFileSync(join(s.directory, "apps/web/wrangler.jsonc"), "utf8"), /"name": "acme-cloud-web"/);
	assert.match(readFileSync(join(s.directory, "apps/web/src/routes/__root.tsx"), "utf8"), /title: "Acme Cloud"/);
	assert.match(readFileSync(join(s.directory, "apps/web/src/routes/index.tsx"), "utf8"), /@acme-cloud\/core/);
	assert.match(readFileSync(join(s.directory, "apps/web/test/home.test.ts"), "utf8"), /Hello, Acme Cloud!/);
	assert.match(readFileSync(join(s.directory, ".github/workflows/ci.yml"), "utf8"), /@acme-cloud\/web/);
	assert.match(
		readFileSync(join(s.directory, "progress.md"), "utf8"),
		/Initialized Acme Cloud \(acme-cloud\) from PI-Starter/,
	);
});

test("init:project rejects invalid project names", (t) => {
	const s = sandbox(t);
	s.copy("scripts/init-project.mjs");
	const result = s.node("scripts/init-project.mjs", "--name", "Bad Name!");
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /lowercase slug/);
});
