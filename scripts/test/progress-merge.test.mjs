import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { root, sandbox } from "./helpers.mjs";

const ENTRY_FIELDS =
	"<br>Trigger: commit<br>Learning: Pin &lt;deps&gt; &amp; lockfile<br>Context: chore: bump deps" +
	"<br>Branch: BRANCH<br>Actor: Test User &lt;test@example.invalid&gt;" +
	"<br>Changed Paths: package-lock.json, package.json, LAST";

function appendEntry({ run, node, directory }, branch, lastPath) {
	run("git", ["switch", "-qc", branch, "main"]);
	const appended = node(
		"scripts/progress-log.mjs",
		"append",
		"--trigger",
		"commit",
		"--learning",
		"Pin <deps> &\nlockfile",
		"--message",
		"chore: bump deps",
		"--files",
		`package-lock.json,package.json,${lastPath}`,
	);
	assert.equal(appended.status, 0, appended.stderr);
	run("git", ["commit", "-qam", branch]);
	return readFileSync(join(directory, "progress.md"), "utf8");
}

test("parallel branches keep each appended progress entry whole when merged", (t) => {
	const s = sandbox(t);
	const history = readFileSync(join(root, "progress.md"), "utf8");
	s.copy(".gitattributes");
	s.copy("scripts/progress-log.mjs");
	s.write("progress.md", history);
	s.run("git", ["add", "."]);
	s.run("git", ["commit", "-qm", "base"]);

	const first = appendEntry(s, "first", "a.ts");
	const second = appendEntry(s, "second", "b.ts");
	assert.ok(first.startsWith(history));
	assert.ok(second.startsWith(history));
	const firstEntry = first.slice(history.length);
	const secondEntry = second.slice(history.length);
	const timestamp = /^- \*\*\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\*\*/;
	for (const [entry, branch, lastPath] of [
		[firstEntry, "first", "a.ts"],
		[secondEntry, "second", "b.ts"],
	]) {
		assert.match(entry, timestamp);
		assert.equal(
			entry.replace(timestamp, ""),
			`${ENTRY_FIELDS.replace("BRANCH", branch).replace("LAST", lastPath)}\n`,
		);
	}

	s.run("git", ["merge", "--no-ff", "--no-edit", "first"]);
	assert.equal(readFileSync(join(s.directory, "progress.md"), "utf8"), `${history}${secondEntry}${firstEntry}`);
});
