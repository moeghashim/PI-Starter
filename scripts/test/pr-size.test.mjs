import assert from "node:assert/strict";
import test from "node:test";
import { sandbox } from "./helpers.mjs";

test("size counts added and removed authored lines and prints a warning without failing", (t) => {
	const { run, write, copy, node } = sandbox(t);
	copy("scripts/pr-size.mjs");
	write("agent/skills-manifest.json", JSON.stringify({ files: [{ localPath: ".agents/skills/vendor" }] }));
	write("old.txt", "remove this\n");
	run("git", ["add", "."]);
	run("git", ["commit", "-qm", "base"]);
	run("git", ["branch", "base"]);
	run("git", ["rm", "old.txt"]);
	write("src/new.txt", "new line\n".repeat(1500));
	write("package-lock.json", "locked\n".repeat(100));
	write(".agents/skills/vendor/SKILL.md", "vendored\n".repeat(100));
	write("src/routeTree.gen.ts", "generated\n".repeat(100));
	run("git", ["add", "."]);
	run("git", ["commit", "-qm", "large"]);
	const result = node("scripts/pr-size.mjs", "base");
	assert.equal(result.status, 0, result.stderr);
	assert.match(result.stderr, /1501 changed lines.*1500/);
	assert.notEqual(node("scripts/pr-size.mjs", "missing-base").status, 0);
});
