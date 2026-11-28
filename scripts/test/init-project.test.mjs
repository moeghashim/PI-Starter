import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { sandbox } from "./helpers.mjs";

test("init:project renames identifiers, refreshes pnpm-lock.yaml for frozen installs, and logs progress", (t) => {
	const s = sandbox(t);
	s.copy("scripts/init-project.mjs");
	s.copy("scripts/progress-log.mjs");
	s.write("pnpm-workspace.yaml", 'packages:\n  - "apps/*"\n  - "packages/*"\n');
	s.write("progress.md", "# Progress Log\n");
	s.write(
		"package.json",
		JSON.stringify({
			name: "pi-starter",
			private: true,
			scripts: {
				dev: "pnpm --filter @pi-starter/web dev",
				"init:project": "node scripts/init-project.mjs",
			},
		}),
	);
	s.write("packages/core/package.json", JSON.stringify({ name: "@pi-starter/core", version: "0.0.2" }));
	s.write(
		"apps/web/package.json",
		JSON.stringify({
			name: "@pi-starter/web",
			version: "0.0.2",
			dependencies: { "@pi-starter/core": "workspace:^" },
		}),
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
	s.run("pnpm", ["install", "--lockfile-only", "--ignore-scripts"]);
	s.run("git", ["add", "."]);
	s.run("git", ["commit", "-q", "-m", "fixture"]);

	const result = s.exec("pnpm", ["run", "init:project", "--name", "acme-cloud", "--title", "Acme Cloud"]);
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

	// The regenerated lockfile must satisfy frozen CI installs after renaming workspace deps.
	const frozen = s.exec("pnpm", ["install", "--frozen-lockfile", "--ignore-scripts"]);
	assert.equal(frozen.status, 0, frozen.stderr);
});

test("init:project also accepts a leading -- separator and rejects invalid names", (t) => {
	const s = sandbox(t);
	s.copy("scripts/init-project.mjs");
	s.write("package.json", JSON.stringify({ name: "pi-starter", private: true }));
	const withSeparator = s.node("scripts/init-project.mjs", "--", "--name", "beta-app", "--skip-progress");
	assert.equal(withSeparator.status, 0, withSeparator.stderr);
	assert.equal(JSON.parse(readFileSync(join(s.directory, "package.json"), "utf8")).name, "beta-app");

	const invalid = s.node("scripts/init-project.mjs", "--name", "Bad Name!");
	assert.notEqual(invalid.status, 0);
	assert.match(invalid.stderr, /lowercase slug/);
});
