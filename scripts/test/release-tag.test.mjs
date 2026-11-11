import assert from "node:assert/strict";
import test from "node:test";

import {
	attemptRelease,
	attemptTag,
	mergedReleaseFollowedByDependencyMerge,
	mergePullRequest,
	releaseFixture,
	remoteTags,
} from "./release-fixture.mjs";

test("release:tag skips a later revert that quotes the release subject and tags the release merge", (t) => {
	const f = releaseFixture(t, null);
	assert.equal(attemptRelease(f).status, 0);
	f.run("git", ["switch", "main"]);
	const release = mergePullRequest(f, 1, "release/v1.0.1", "chore(release): v1.0.1");
	f.run("git", ["switch", "-c", "revert-release"]);
	f.run("git", ["revert", "--no-edit", "-m", "1", release]);
	f.run("git", ["switch", "main"]);
	mergePullRequest(f, 2, "revert-release", 'Revert "chore(release): v1.0.1"');
	f.run("git", ["push", "origin", "main"]);
	const tagged = attemptTag(f);
	assert.equal(tagged.status, 0, tagged.stderr);
	assert.equal(f.run("git", ["rev-list", "-n", "1", "v1.0.1"]), release);
	assert.equal(f.run("git", ["tag", "--list"]), "v1.0.1");
});

test("release:tag refuses a release subject whose tree carries a different version", (t) => {
	const f = releaseFixture(t, null);
	assert.equal(attemptRelease(f).status, 0);
	f.run("git", ["switch", "main"]);
	mergePullRequest(f, 1, "release/v1.0.1", "chore(release): v1.0.1");
	f.run("git", ["commit", "-q", "--allow-empty", "-m", "chore(release): v1.0.2"]);
	f.run("git", ["push", "origin", "main"]);
	const result = attemptTag(f);
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /is labeled chore\(release\): v1\.0\.2 but its tree is at 1\.0\.1/);
	assert.equal(f.run("git", ["tag", "--list"]), "");
	assert.equal(f.run("git", ["ls-remote", "--tags", "origin"]), "");
});

test("release:tag tags a fast-forwarded release once, pushes only the tag, and reruns cleanly", (t) => {
	const f = releaseFixture(t, null);
	assert.match(attemptTag(f).stderr, /origin\/main has no chore\(release\) commit/);
	assert.equal(attemptRelease(f).status, 0);
	f.run("git", ["switch", "main"]);
	f.run("git", ["merge", "--ff-only", "release/v1.0.1"]);
	f.run("git", ["push", "origin", "main"]);
	const tagged = attemptTag(f);
	assert.equal(tagged.status, 0, tagged.stderr);
	assert.equal(remoteTags(f).length, 2);
	assert.match(remoteTags(f).join("\n"), /refs\/tags\/v1\.0\.1$/m);
	assert.equal(f.run("git", ["rev-list", "-n", "1", "v1.0.1"]), f.run("git", ["rev-parse", "main"]));
	const rerun = attemptTag(f);
	assert.equal(rerun.status, 0, rerun.stderr);
	assert.equal(remoteTags(f).length, 2);
	assert.equal(f.run("git", ["rev-list", "-n", "1", "v1.0.1"]), f.run("git", ["rev-parse", "main"]));
});

test("release:tag tags the release merge on origin/main regardless of the local checkout", (t) => {
	const { f, release } = mergedReleaseFollowedByDependencyMerge(t);
	const fixtureRoot = f.run("git", ["rev-list", "--max-parents=0", "HEAD"]);
	f.run("git", ["checkout", "-q", fixtureRoot]);
	const tagged = attemptTag(f);
	assert.equal(tagged.status, 0, tagged.stderr);
	assert.equal(f.run("git", ["rev-list", "-n", "1", "v1.0.1"]), release);
	assert.equal(f.run("git", ["rev-parse", "HEAD"]), fixtureRoot);
	assert.match(remoteTags(f).join("\n"), /refs\/tags\/v1\.0\.1$/m);
	f.run("git", ["switch", "release/v1.0.1"]);
	f.run("git", ["tag", "-d", "v1.0.1"]);
	f.run("git", ["push", "--delete", "origin", "v1.0.1"]);
	const fromBranch = attemptTag(f);
	assert.equal(fromBranch.status, 0, fromBranch.stderr);
	assert.equal(f.run("git", ["rev-list", "-n", "1", "v1.0.1"]), release);
	assert.notEqual(release, f.run("git", ["rev-parse", "release/v1.0.1"]));
});

test("release:tag refuses a tag that points away from the release commit", (t) => {
	const { f, release } = mergedReleaseFollowedByDependencyMerge(t);
	f.run("git", ["tag", "v1.0.1", "HEAD"]);
	const result = attemptTag(f);
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, new RegExp(`v1\\.0\\.1 points at ${f.run("git", ["rev-parse", "HEAD"])}`));
	assert.equal(f.run("git", ["rev-list", "-n", "1", "v1.0.1"]), f.run("git", ["rev-parse", "HEAD"]));
	assert.notEqual(f.run("git", ["rev-list", "-n", "1", "v1.0.1"]), release);
	assert.equal(remoteTags(f).length, 0);
});

test("release:tag refuses --publish unless HEAD is the release commit", (t) => {
	const { f, release } = mergedReleaseFollowedByDependencyMerge(t);
	const refused = attemptTag(f, "--publish");
	assert.notEqual(refused.status, 0);
	const expected = `HEAD must be the release commit to --publish\\. Run \`git checkout ${release}\``;
	assert.match(refused.stderr, new RegExp(expected));
	assert.equal(f.run("git", ["tag", "--list"]), "");
	assert.equal(remoteTags(f).length, 0);
});
