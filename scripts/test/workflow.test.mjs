import assert from "node:assert/strict";
import { chmodSync, copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { root, sandbox } from "./helpers.mjs";

const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

test("pre-commit preserves partial staging, including paths with spaces", (t) => {
	const f = sandbox(t);
	f.write("package.json", JSON.stringify({ scripts: { check: "node -e 'process.exit(0)'" } }));
	f.write("progress.md", "original\n");
	f.write("file with spaces.txt", "original\n");
	f.copy("scripts/progress-append-only-check.mjs");
	f.run("git", ["add", "."]);
	f.run("git", ["commit", "-m", "fixture"]);
	f.write("file with spaces.txt", "staged\n");
	f.run("git", ["add", "file with spaces.txt"]);
	f.write("file with spaces.txt", "staged\nunstaged\n");
	f.write("other.txt", "untracked\n");
	f.run("sh", [join(root, ".husky/pre-commit")]);
	assert.equal(f.run("git", ["show", ":file with spaces.txt"]), "staged");
	assert.equal(readFileSync(join(f.directory, "file with spaces.txt"), "utf8"), "staged\nunstaged\n");
	assert.match(f.run("git", ["status", "--porcelain"]), /\?\? other.txt/);
	f.write("progress.md", "rewritten\n");
	f.run("git", ["add", "progress.md"]);
	const rejected = f.exec("sh", [join(root, ".husky/pre-commit")]);
	assert.notEqual(rejected.status, 0);
});

test("version bump preserves external resolutions and installed dependencies", (t) => {
	const f = sandbox(t);
	f.write(
		"package.json",
		JSON.stringify({
			type: "module",
			private: true,
			workspaces: ["packages/*"],
			scripts: {
				"version:patch": manifest.scripts["version:patch"],
				"version:sync": manifest.scripts["version:sync"],
			},
		}),
	);
	f.write(
		"packages/core/package.json",
		JSON.stringify({
			name: "fixture-core",
			version: "1.0.0",
			dependencies: { "fixture-external": "file:../../external" },
		}),
	);
	f.write("external/package.json", JSON.stringify({ name: "fixture-external", version: "1.0.0" }));
	f.copy("scripts/sync-versions.js");
	f.run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"]);
	f.write("node_modules/fixture-core/preserve.txt", "installed state");
	const installedDirectory = statSync(join(f.directory, "node_modules")).ino;
	const before = JSON.parse(readFileSync(join(f.directory, "package-lock.json")));
	f.run("npm", ["run", "version:patch"]);
	const after = JSON.parse(readFileSync(join(f.directory, "package-lock.json")));
	assert.equal(after.packages["packages/core"].version, "1.0.1");
	assert.equal(statSync(join(f.directory, "node_modules")).ino, installedDirectory);
	assert.deepEqual(after.packages.external, before.packages.external);
	assert.deepEqual(after.packages["node_modules/fixture-external"], before.packages["node_modules/fixture-external"]);
	assert.equal(readFileSync(join(f.directory, "node_modules/fixture-core/preserve.txt"), "utf8"), "installed state");
});

test("prepare-commit-msg adds a DCO sign-off without duplicating an existing one", (t) => {
	const f = sandbox(t);
	const hooks = join(f.directory, "hooks");
	mkdirSync(hooks);
	copyFileSync(join(root, ".husky/prepare-commit-msg"), join(hooks, "prepare-commit-msg"));
	chmodSync(join(hooks, "prepare-commit-msg"), 0o755);
	f.run("git", ["config", "core.hooksPath", hooks]);
	const signoff = /^Signed-off-by: Test User <test@example.invalid>$/gm;
	f.write("tracked.txt", "one\n");
	f.run("git", ["add", "."]);
	f.run("git", ["commit", "-m", "chore: unsigned"]);
	assert.equal(f.run("git", ["log", "-1", "--format=%B"]).match(signoff).length, 1);
	f.write("tracked.txt", "two\n");
	f.run("git", ["commit", "-s", "-am", "chore: signed"]);
	assert.equal(f.run("git", ["log", "-1", "--format=%B"]).match(signoff).length, 1);
	const messageFile = join(f.directory, "COMMIT_EDITMSG");
	writeFileSync(messageFile, "chore: template\n\n# Please enter the commit message.\n");
	f.run("sh", [join(hooks, "prepare-commit-msg"), messageFile]);
	const message = readFileSync(messageFile, "utf8");
	assert.equal(message.match(signoff).length, 1);
	assert.ok(message.indexOf("Signed-off-by") < message.indexOf("# Please"), message);
});
