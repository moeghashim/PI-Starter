import assert from "node:assert/strict";
import { chmodSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { sandbox } from "./helpers.mjs";

function setup(t) {
	const repo = sandbox(t);
	const { copy, directory, env, run, write } = repo;
	copy("scripts/batch.mjs");
	const gate = join(directory, "gate.git");
	env.BATCH_TEST_DIR = directory;
	env.PATH = `${join(directory, "bin")}:${env.PATH}`;
	write(".gitignore", "gate.git/\nbin/\nfixture/\n");
	write("fixture/intent", "Help the project deliver this task.\n");
	write("fixture/status", "");
	write("fixture/open", "[]");
	write("fixture/merged", "[]");
	run("git", ["add", "."]);
	run("git", ["commit", "-qm", "base"]);
	run("git", ["branch", "batch/1"]);
	run("git", ["branch", "batch/2"]);
	run("git", ["switch", "-qc", "codex/task"]);
	write("feature.txt", "working task");
	run("git", ["add", "."]);
	run("git", ["commit", "-qm", "task"]);
	run("git", ["init", "--bare", "-q", gate]);
	run("git", ["remote", "add", "origin", gate]);
	run("git", ["remote", "add", "no-mistakes", gate]);
	run("git", ["push", "-q", "origin", "--all"]);

	for (const [name, body] of Object.entries({
		gh: `
const [_, verb, ...rest] = args;
if (verb === "list") process.stdout.write(read(!rest.includes("main") ? "empty" : rest.includes("merged") ? "merged" : "open"));
if (verb === "view") process.stdout.write(read("pr"));
if (verb === "merge") fs.appendFileSync(path("merges"), JSON.stringify(rest));
`,
		"no-mistakes": `
if (args[1] === "status") process.stdout.write(read("status"));
if (args[1] === "run") {
  fs.writeFileSync(path("launch"), JSON.stringify(args));
  if (!read("status")) fs.writeFileSync(path("status"), 'run:\\n  id: "RUN"\\n  status: running\\n');
}
`,
	})) {
		write(
			`bin/${name}`,
			`#!${process.execPath}
const fs = require("node:fs");
const args = process.argv.slice(2);
const path = (name) => process.env.BATCH_TEST_DIR + "/fixture/" + name;
const read = (name) => fs.readFileSync(path(name), "utf8");
${body}`,
		);
		chmodSync(join(directory, "bin", name), 0o755);
	}
	write("fixture/empty", "[]");
	const batch = (...args) => repo.node("scripts/batch.mjs", ...args);
	const stored = (name) => JSON.parse(readFileSync(join(directory, "fixture", name), "utf8"));
	const open = (headRefName) => ({ headRefName, baseRefName: "main", isCrossRepository: false });
	return { ...repo, gate, batch, stored, open };
}

test("the lock survives an unfinished light gate and merge requires its exact passing head", (t) => {
	const { gate, batch, stored, open, run, write } = setup(t);
	write("fixture/open", JSON.stringify([open("batch/1")]));
	const first = batch("task", "fixture/intent");
	assert.equal(first.status, 0, first.stderr);
	assert.deepEqual(stored("launch").slice(-4), ["--base-branch", "batch/2", "--skip", "test,document,ci"]);
	assert.equal(run("git", ["--git-dir", gate, "config", "pi-starter.batch-base"]), "batch/2");
	assert.match(batch("target").stderr, /reserved/);
	assert.match(batch("release").stderr, /active/);

	const sha = run("git", ["rev-parse", "HEAD"]);
	const pr = { ...open("codex/task"), headRefOid: sha, baseRefName: "batch/2", state: "OPEN" };
	write("fixture/pr", JSON.stringify(pr));
	write(
		"fixture/status",
		`run:\n  id: "RUN"\n  status: completed\n  head_sha: ${sha}\n  steps[4]{step,status,findings,duration_ms}:\n` +
			["review", "lint", "push", "pr"].map((step) => `    ${step},completed,0,0\n`).join(""),
	);
	const done = batch("resume");
	assert.equal(done.status, 0, done.stderr);
	assert.equal(run("git", ["--git-dir", gate, "config", "pi-starter.batch-base"]), "");

	write("fixture/pr", JSON.stringify({ ...pr, headRefOid: "f".repeat(40) }));
	assert.match(batch("merge", "15").stderr, /no passing batch gate receipt/);
	write("fixture/pr", JSON.stringify(pr));
	const merged = batch("merge", "15");
	assert.equal(merged.status, 0, merged.stderr);
	assert.deepEqual(stored("merges"), ["15", "--merge", "--match-head-commit", sha]);
});

test("repairs stay in the current batch and publishing checks the queue", (t) => {
	const { batch, open, write, stored, run } = setup(t);
	write("fixture/open", JSON.stringify([open("batch/1")]));
	assert.equal(batch("target", "repair").stdout.trim(), "batch/1");
	run("git", ["switch", "batch/2"]);
	assert.match(batch("publish", "fixture/intent").stderr, /Switch to batch\/1/);
	run("git", ["switch", "batch/1"]);
	const result = batch("publish", "fixture/intent");
	assert.equal(result.status, 0, result.stderr);
	assert.deepEqual(stored("launch").slice(-4), ["--base-branch", "main", "--skip", "rebase,ci"]);
});

test("a concurrent batch process fails before it can touch remote refs", (t) => {
	const { gate, batch } = setup(t);
	mkdirSync(join(gate, "pi-starter-batch.lock"));
	assert.match(batch("target").stderr, /Another batch command/);
});
