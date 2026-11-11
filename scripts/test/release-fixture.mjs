import assert from "node:assert/strict";
import { join } from "node:path";

import { sandbox } from "./helpers.mjs";

export function releaseFixture(t, failingCheck = "agent:check", bumpedVersion = "1.0.1") {
	const f = sandbox(t);
	const scripts = Object.fromEntries(
		["version:patch", "build", "check", "test", "agent:check", "fallow:audit"].map((name) => [
			name,
			`node record.cjs ${name}`,
		]),
	);
	f.write("package.json", JSON.stringify({ scripts }));
	f.write("packages/core/package.json", JSON.stringify({ name: "fixture-core", version: "1.0.0", private: true }));
	f.write(
		"record.cjs",
		[
			"const fs = require('node:fs');",
			"fs.appendFileSync('calls.txt', process.argv[2] + '\\n');",
			"if (process.argv[2] === 'version:patch') {",
			"  const path = 'packages/core/package.json';",
			"  const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));",
			`  fs.writeFileSync(path, JSON.stringify({ ...pkg, version: ${JSON.stringify(bumpedVersion)} }));`,
			"}",
			`process.exit(process.argv[2] === ${JSON.stringify(failingCheck)} ? 1 : 0);`,
		].join("\n"),
	);
	f.write("packages/core/CHANGELOG.md", "# Changelog\n\n## [Unreleased]\n\n## [1.0.0] - 2026-01-01\n");
	f.write("scripts/progress-log.mjs", "// Fixture progress logger.\n");
	for (const script of ["release.mjs", "release-lib.mjs", "release-tag.mjs"]) {
		f.copy(`scripts/${script}`);
	}
	f.run("git", ["add", "."]);
	f.run("git", ["commit", "-m", "fixture"]);
	f.run("git", ["init", "--bare", "-b", "main", "remote.git"]);
	f.run("git", ["config", "status.showUntrackedFiles", "normal"]);
	f.write(".git/info/exclude", "remote.git/\ncalls.txt\n");
	f.run("git", ["remote", "add", "origin", join(f.directory, "remote.git")]);
	f.run("git", ["push", "origin", "main"]);
	return f;
}

export const attemptRelease = (f) => f.node("scripts/release.mjs", "patch", "--learning", "fixture");

export const attemptTag = (f, ...args) => f.node("scripts/release-tag.mjs", ...args);

export function mergePullRequest(f, number, branch, title) {
	const subject = `Merge pull request #${number} from fixture/${branch}`;
	f.run("git", ["merge", "--no-ff", "-m", subject, "-m", title, branch]);
	return f.run("git", ["rev-parse", "HEAD"]);
}

export function mergedReleaseFollowedByDependencyMerge(t) {
	const f = releaseFixture(t, null);
	assert.equal(attemptRelease(f).status, 0);
	f.run("git", ["switch", "main"]);
	const release = mergePullRequest(f, 1, "release/v1.0.1", "chore(release): v1.0.1");
	f.run("git", ["switch", "-c", "dependabot/npm/fixture"]);
	f.write("later.txt", "dependency bump\n");
	f.run("git", ["add", "later.txt"]);
	f.run("git", ["commit", "-qm", "chore(deps): bump fixture"]);
	f.run("git", ["switch", "main"]);
	mergePullRequest(f, 2, "dependabot/npm/fixture", "chore(deps): bump fixture");
	f.run("git", ["push", "origin", "main"]);
	return { f, release };
}

export function remoteTags(f) {
	return f.run("git", ["ls-remote", "--tags", "origin"]).split("\n").filter(Boolean);
}
