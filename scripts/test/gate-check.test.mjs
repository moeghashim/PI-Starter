import assert from "node:assert/strict";
import { chmodSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { sandbox } from "./helpers.mjs";

test("light checks build and test the changed workspace and its dependents", (t) => {
	const { run, write, copy, node } = sandbox(t);
	copy("scripts/gate-check.mjs");
	write("package.json", JSON.stringify({ workspaces: ["apps/*", "packages/*"] }));
	write("packages/core/package.json", JSON.stringify({ name: "core" }));
	write("packages/other/package.json", JSON.stringify({ name: "other" }));
	write("apps/web/package.json", JSON.stringify({ name: "web", dependencies: { core: "*" } }));
	run("git", ["add", "."]);
	run("git", ["commit", "-qm", "base"]);
	run("git", ["update-ref", "refs/remotes/origin/batch/1", "HEAD"]);
	run("git", ["config", "pi-starter.batch-base", "batch/1"]);
	write("packages/core/index.js", "export const a = 1;\n");
	run("git", ["add", "."]);
	run("git", ["commit", "-qm", "change core"]);

	const result = node("scripts/gate-check.mjs", "plan", "light");
	assert.equal(result.status, 0, result.stderr);
	assert.deepEqual(JSON.parse(result.stdout), [
		["run", "pr:size", "--", run("git", ["rev-parse", "refs/remotes/origin/batch/1"])],
		["run", "preflight:native-deps"],
		["exec", "--", "biome", "check", "--error-on-warnings", "apps/web", "packages/core"],
		["run", "build", "--if-present", "-w", "apps/web", "-w", "packages/core"],
		["run", "test", "--if-present", "-w", "apps/web", "-w", "packages/core"],
	]);
	assert.notEqual(node("scripts/gate-check.mjs", "plan", "light", "--missing").status, 0);
});

test("full checks keep lint, the complete test suite and optional e2e", (t) => {
	const { copy, node } = sandbox(t);
	copy("scripts/gate-check.mjs");
	const result = node("scripts/gate-check.mjs", "plan", "full");
	assert.equal(result.status, 0, result.stderr);
	const commands = JSON.parse(result.stdout);
	assert.ok(commands.some((args) => args[1] === "check"));
	assert.ok(commands.some((args) => args[0] === "test"));
	assert.ok(commands.some((args) => args[1] === "test:e2e"));
	assert.ok(commands.some((args) => args[1] === "fallow:audit"));
});

test("the full gate rejects unreviewed changes to the submitted batch checkout", (t) => {
	const { run, write, copy, node } = sandbox(t);
	copy("scripts/gate-check.mjs");
	run("git", ["add", "."]);
	run("git", ["commit", "-qm", "batch"]);
	run("git", ["config", "pi-starter.batch-base", "main"]);
	run("git", ["config", "pi-starter.batch-head", run("git", ["rev-parse", "HEAD"])]);
	write("unexpected.txt", "unexpected new code");
	const result = node("scripts/gate-check.mjs", "gate", "lint");
	assert.equal(result.status, 1);
	assert.match(result.stderr, /full gate changed the batch checkout/);
});

test("the gate records a check as passed only for a reserved run whose commands all succeed", (t) => {
	const { directory, env, exec, run, write, copy, node } = sandbox(t);
	copy("scripts/gate-check.mjs");
	write("bin/npm", '#!/bin/sh\nexit "$NPM_STATUS"\n');
	chmodSync(join(directory, "bin/npm"), 0o755);
	env.PATH = `${join(directory, "bin")}:${env.PATH}`;
	env.NPM_STATUS = "0";
	run("git", ["add", "."]);
	run("git", ["commit", "-qm", "batch"]);
	const head = run("git", ["rev-parse", "HEAD"]);
	const proof = (check) => exec("git", ["config", "--get", `pi-starter.batch-${check}-pass`]).stdout.trim();

	assert.equal(node("scripts/gate-check.mjs", "gate", "lint").status, 0);
	assert.equal(proof("lint"), "");

	run("git", ["config", "pi-starter.batch-base", "main"]);
	run("git", ["config", "pi-starter.batch-head", head]);
	for (const check of ["lint", "test"]) {
		assert.equal(node("scripts/gate-check.mjs", "gate", check).status, 0);
		assert.equal(proof(check), head);
	}

	env.NPM_STATUS = "1";
	for (const check of ["lint", "test"]) {
		assert.equal(node("scripts/gate-check.mjs", "gate", check).status, 1);
		assert.equal(proof(check), "");
	}
});
