import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { attemptRelease, releaseFixture } from "./release-fixture.mjs";

test("release rejects feature branches and unpublished main commits before bumping", (t) => {
	const f = releaseFixture(t);
	f.run("git", ["switch", "-c", "feature"]);
	assert.match(attemptRelease(f).stderr, /switch to main/);
	f.run("git", ["switch", "main"]);
	f.run("git", ["commit", "--allow-empty", "-m", "ahead"]);
	assert.match(attemptRelease(f).stderr, /main must match origin\/main/);
	assert.equal(f.run("git", ["status", "--porcelain"]), "");
});

test("release fetch detects remote advancement and refuses dirty or detached trees", (t) => {
	const f = releaseFixture(t);
	const original = f.run("git", ["rev-parse", "HEAD"]);
	f.write("dirty.txt", "pending work");
	assert.match(attemptRelease(f).stderr, /uncommitted changes/);
	f.run("git", ["add", "dirty.txt"]);
	f.run("git", ["commit", "-m", "remote advancement"]);
	f.run("git", ["push", "origin", "main"]);
	f.run("git", ["switch", "--detach", original]);
	assert.match(attemptRelease(f).stderr, /switch to main/);
	f.run("git", ["branch", "-f", "main", original]);
	f.run("git", ["switch", "main"]);
	f.run("git", ["update-ref", "refs/remotes/origin/main", original]);
	assert.match(attemptRelease(f).stderr, /main must match origin\/main/);
	assert.equal(f.run("git", ["status", "--porcelain"]), "");
});

for (const failingCheck of ["agent:check", "fallow:audit"]) {
	test(`release stops before commits and tags when ${failingCheck} fails`, (t) => {
		const f = releaseFixture(t, failingCheck);
		const head = f.run("git", ["rev-parse", "HEAD"]);
		assert.notEqual(attemptRelease(f).status, 0);
		const calls = readFileSync(join(f.directory, "calls.txt"), "utf8").trim().split("\n");
		assert.equal(calls[0], "version:patch");
		assert.equal(calls.at(-1), failingCheck);
		assert.equal(f.run("git", ["rev-parse", "HEAD"]), head);
		assert.equal(f.run("git", ["tag", "--list"]), "");
	});
}

test("release prepares one signed commit on a release branch without touching main or tags", (t) => {
	const f = releaseFixture(t, null);
	const mainHead = f.run("git", ["rev-parse", "main"]);
	const result = attemptRelease(f);
	assert.equal(result.status, 0, result.stderr);
	assert.equal(f.run("git", ["branch", "--show-current"]), "release/v1.0.1");
	assert.equal(f.run("git", ["rev-list", "--count", "main..HEAD"]), "1");
	assert.equal(f.run("git", ["log", "-1", "--format=%s"]), "chore(release): v1.0.1");
	assert.match(f.run("git", ["log", "-1", "--format=%b"]), /^Signed-off-by: Test User <test@example\.invalid>$/m);
	assert.match(
		readFileSync(join(f.directory, "packages/core/CHANGELOG.md"), "utf8"),
		/## \[Unreleased\]\n\n## \[1\.0\.1\] - \d{4}-\d{2}-\d{2}\n\n## \[1\.0\.0\]/,
	);
	assert.equal(f.run("git", ["rev-parse", "main"]), mainHead);
	assert.equal(f.run("git", ["tag", "--list"]), "");
	assert.equal(f.run("git", ["status", "--porcelain"]), "");
});

test("release refuses a version whose tag already exists on the remote", (t) => {
	const f = releaseFixture(t, null);
	f.run("git", ["tag", "v1.0.1"]);
	f.run("git", ["push", "origin", "v1.0.1"]);
	f.run("git", ["tag", "-d", "v1.0.1"]);
	const result = attemptRelease(f);
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /tag v1\.0\.1 already exists/);
	assert.equal(f.run("git", ["log", "-1", "--format=%s"]), "fixture");
	assert.equal(f.run("git", ["branch", "--show-current"]), "main");
	assert.equal(f.run("git", ["status", "--porcelain"]), "");
	assert.equal(existsSync(join(f.directory, "calls.txt")), false);
});

test("release refuses a stale release branch before switching or bumping", (t) => {
	const f = releaseFixture(t, null);
	f.run("git", ["branch", "release/v1.0.1"]);
	const result = attemptRelease(f);
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /branch release\/v1\.0\.1 already exists/);
	assert.equal(f.run("git", ["branch", "--show-current"]), "main");
	assert.equal(f.run("git", ["status", "--porcelain"]), "");
	assert.equal(existsSync(join(f.directory, "calls.txt")), false);
});

test("release stops when the version scripts produce a different version than predicted", (t) => {
	const f = releaseFixture(t, null, "1.0.1-beta.0");
	const head = f.run("git", ["rev-parse", "HEAD"]);
	const result = attemptRelease(f);
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /produced 1\.0\.1-beta\.0, expected 1\.0\.1/);
	assert.equal(readFileSync(join(f.directory, "calls.txt"), "utf8").trim(), "version:patch");
	assert.equal(f.run("git", ["rev-parse", "HEAD"]), head);
	assert.equal(f.run("git", ["tag", "--list"]), "");
	assert.equal(f.run("git", ["status", "--porcelain"]), "M packages/core/package.json");
});

test("release refuses a changelog without an Unreleased section before bumping", (t) => {
	const f = releaseFixture(t, null);
	f.write("packages/core/CHANGELOG.md", "# Changelog\n\n## [1.0.0] - 2026-01-01\n");
	f.run("git", ["commit", "-qam", "drop unreleased"]);
	f.run("git", ["push", "origin", "main"]);
	const result = attemptRelease(f);
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /has no "## \[Unreleased\]" section/);
	assert.equal(f.run("git", ["branch", "--show-current"]), "main");
	assert.equal(f.run("git", ["status", "--porcelain"]), "");
	assert.equal(existsSync(join(f.directory, "calls.txt")), false);
});
