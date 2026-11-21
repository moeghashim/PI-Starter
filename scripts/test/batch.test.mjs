import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { sandbox } from "./helpers.mjs";

// What `no-mistakes axi status` v1.106.1 reports on a branch with no run: exit 0, no top-level run object,
// and a summary of runs that belong to other branches.
const noRun = `current_branch: codex/task
runs_on_current_branch: 0
runs[1]{id,branch,status,head_sha}:
  OTHER,codex/other,completed,${"a".repeat(40)}
  steps[4]{step,status,findings,duration_ms}:
    review,completed,0,0
    lint,completed,0,0
    push,completed,0,0
    pr,completed,0,0
help[1]: Start a run on this branch with no-mistakes axi run
`;

function setup(t) {
	const repo = sandbox(t);
	const { copy, directory, env, run, write } = repo;
	copy("scripts/batch.mjs");
	const gate = join(directory, "gate.git");
	env.BATCH_TEST_DIR = directory;
	env.PATH = `${join(directory, "bin")}:${env.PATH}`;
	write(".gitignore", "gate.git/\nbin/\nfixture/\n");
	write("fixture/intent", "Help the project deliver this task.\n");
	write("fixture/status", noRun);
	write("fixture/after-launch", 'run:\n  id: "RUN"\n  status: running\n');
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
if (args[1] === "status") {
  process.stdout.write(read("status"));
  if (read("status").startsWith("error:")) process.exitCode = 1;
}
if (args[1] === "run") {
  fs.writeFileSync(path("launch"), JSON.stringify(args));
  fs.writeFileSync(path("status"), read("after-launch"));
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

test("a run that belongs to another branch is never recorded as this branch's result", (t) => {
	const { gate, batch, write } = setup(t);
	write("fixture/after-launch", noRun);
	const launched = batch("task", "fixture/intent");
	assert.equal(launched.status, 1);
	assert.match(launched.stderr, /did not record a run/);
	const released = batch("release");
	assert.equal(released.status, 0, released.stderr);
	assert.equal(existsSync(join(gate, "pi-starter-receipts")), false);
	assert.equal(existsSync(join(gate, "pi-starter-batch.json")), false);
});

test("only the known no-run diagnostic counts as no previous run", (t) => {
	const { gate, batch, stored, write } = setup(t);
	write("fixture/status", "error: repo not initialized (run 'no-mistakes init' first)\n");
	const failed = batch("task", "fixture/intent");
	assert.equal(failed.status, 1);
	assert.match(failed.stderr, /repo not initialized/);
	assert.equal(existsSync(join(gate, "pi-starter-batch.json")), false);

	write("fixture/status", "error: no run found for this branch; use --run <id> to inspect a specific run\n");
	const launched = batch("task", "fixture/intent");
	assert.equal(launched.status, 0, launched.stderr);
	assert.equal(stored("launch")[1], "run");
});

test("resume and release are harmless when nothing is reserved", (t) => {
	const { batch } = setup(t);
	for (const command of ["resume", "release"]) {
		const result = batch(command);
		assert.equal(result.status, 0, result.stderr);
		assert.match(result.stdout, /No reservation/);
	}
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

test("a batch with passing gate evidence cannot merge after main advances", (t) => {
	const { batch, open, run, write } = setup(t);
	write("fixture/open", JSON.stringify([open("batch/1")]));
	run("git", ["switch", "batch/1"]);
	const sha = run("git", ["rev-parse", "HEAD"]);
	write("fixture/pr", JSON.stringify({ ...open("batch/1"), headRefOid: sha, state: "OPEN" }));
	const started = batch("publish", "fixture/intent");
	assert.equal(started.status, 0, started.stderr);
	write(
		"fixture/status",
		`run:\n  id: "RUN"\n  status: completed\n  head_sha: ${sha}\n  steps[5]{step,status,findings,duration_ms}:\n` +
			["review", "test", "lint", "push", "pr"].map((step) => `    ${step},completed,0,0\n`).join(""),
	);
	const done = batch("resume");
	assert.equal(done.status, 0, done.stderr);

	run("git", ["switch", "main"]);
	write("other-change", "new main commit\n");
	run("git", ["add", "."]);
	run("git", ["commit", "-qm", "advance main"]);
	run("git", ["push", "-q", "origin", "main"]);
	const merge = batch("merge", "15");
	assert.equal(merge.status, 1);
	assert.match(merge.stderr, /Main moved after the batch was validated/);
});
