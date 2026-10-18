import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
	chmodSync,
	copyFileSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

function fixture(t) {
	const directory = mkdtempSync(join(tmpdir(), "pi-workflow-test-"));
	t.after(() => rmSync(directory, { recursive: true, force: true }));
	const env = { ...process.env, HUSKY: "0", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" };
	for (const key of Object.keys(env)) {
		if (key.toLowerCase().startsWith("npm_") || key === "INIT_CWD") delete env[key];
	}
	const run = (command, args) => execFileSync(command, args, { cwd: directory, env, encoding: "utf8" }).trim();
	const write = (name, content) => {
		mkdirSync(dirname(join(directory, name)), { recursive: true });
		writeFileSync(join(directory, name), content);
	};
	run("git", ["init", "-b", "main"]);
	run("git", ["config", "user.name", "Workflow Test"]);
	run("git", ["config", "user.email", "test@example.invalid"]);
	run("git", ["config", "commit.gpgsign", "false"]);
	return { directory, env, run, write };
}

test("pre-commit preserves partial staging, including paths with spaces", (t) => {
	const f = fixture(t);
	f.write("package.json", JSON.stringify({ scripts: { check: "node -e 'process.exit(0)'" } }));
	f.write("progress.md", "original\n");
	f.write("file with spaces.txt", "original\n");
	f.write(
		"scripts/progress-append-only-check.mjs",
		readFileSync(join(root, "scripts/progress-append-only-check.mjs")),
	);
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
	const rejected = spawnSync("sh", [join(root, ".husky/pre-commit")], { cwd: f.directory, env: f.env });
	assert.notEqual(rejected.status, 0);
});

test("version bump preserves external resolutions and installed dependencies", (t) => {
	const f = fixture(t);
	f.write(
		"package.json",
		JSON.stringify({
			type: "module",
			private: true,
			workspaces: ["packages/*"],
			scripts: { "version:patch": manifest.scripts["version:patch"] },
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
	f.write("scripts/sync-versions.js", readFileSync(join(root, "scripts/sync-versions.js")));
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

function releaseFixture(t, failingCheck = "agent:check", bumpedVersion = "1.0.1") {
	const f = fixture(t);
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
		copyFileSync(join(root, "scripts", script), join(f.directory, "scripts", script));
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

function attemptRelease(f) {
	return spawnSync(process.execPath, ["scripts/release.mjs", "patch", "--learning", "fixture"], {
		cwd: f.directory,
		env: f.env,
		encoding: "utf8",
	});
}

function attemptTag(f, ...args) {
	return spawnSync(process.execPath, ["scripts/release-tag.mjs", ...args], {
		cwd: f.directory,
		env: f.env,
		encoding: "utf8",
	});
}

function mergePullRequest(f, number, branch, title) {
	const subject = `Merge pull request #${number} from fixture/${branch}`;
	f.run("git", ["merge", "--no-ff", "-m", subject, "-m", title, branch]);
	return f.run("git", ["rev-parse", "HEAD"]);
}

function mergedReleaseFollowedByDependencyMerge(t) {
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
	assert.match(f.run("git", ["log", "-1", "--format=%b"]), /^Signed-off-by: Workflow Test <test@example\.invalid>$/m);
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

function remoteTags(f) {
	return f.run("git", ["ls-remote", "--tags", "origin"]).split("\n").filter(Boolean);
}

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

test("prepare-commit-msg adds a DCO sign-off without duplicating an existing one", (t) => {
	const f = fixture(t);
	const hooks = join(f.directory, "hooks");
	mkdirSync(hooks);
	copyFileSync(join(root, ".husky/prepare-commit-msg"), join(hooks, "prepare-commit-msg"));
	chmodSync(join(hooks, "prepare-commit-msg"), 0o755);
	f.run("git", ["config", "core.hooksPath", hooks]);
	const signoff = /^Signed-off-by: Workflow Test <test@example.invalid>$/gm;
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
