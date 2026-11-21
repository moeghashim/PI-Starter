import assert from "node:assert/strict";
import test from "node:test";
import { sandbox } from "./helpers.mjs";

test("parallel branches keep both progress entries when merged", (t) => {
	const { run, write, copy } = sandbox(t);
	copy(".gitattributes");
	write("progress.md", "# Progress\n");
	run("git", ["add", "."]);
	run("git", ["commit", "-qm", "base"]);
	run("git", ["switch", "-qc", "first"]);
	write("progress.md", "# Progress\n\n## First entry\n- Learning: first\n");
	run("git", ["commit", "-qam", "first"]);
	run("git", ["switch", "-qc", "second", "main"]);
	write("progress.md", "# Progress\n\n## Second entry\n- Learning: second\n");
	run("git", ["commit", "-qam", "second"]);
	run("git", ["merge", "--no-ff", "--no-edit", "first"]);
	assert.equal(
		run("git", ["show", "HEAD:progress.md"]),
		"# Progress\n\n## Second entry\n- Learning: second\n## First entry\n- Learning: first",
	);
});
