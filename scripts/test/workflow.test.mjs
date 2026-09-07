import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
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

function releaseFixture(t, failingCheck = "agent:check") {
	const f = fixture(t);
	const scripts = Object.fromEntries(
		["version:patch", "build", "check", "test", "agent:check", "fallow:audit"].map((name) => [
			name,
			`node record.cjs ${name}`,
		]),
	);
	f.write("package.json", JSON.stringify({ scripts }));
	f.write("packages/core/package.json", JSON.stringify({ name: "fixture-core", version: "1.0.1", private: true }));
	f.write(
		"record.cjs",
		`require('node:fs').appendFileSync('calls.txt', process.argv[2]+'\\n'); process.exit(process.argv[2] === ${JSON.stringify(failingCheck)} ? 1 : 0);`,
	);
	f.write("scripts/progress-log.mjs", "// Fixture progress logger.\n");
	copyFileSync(join(root, "scripts/release.mjs"), join(f.directory, "scripts/release.mjs"));
	f.run("git", ["add", "."]);
	f.run("git", ["commit", "-m", "fixture"]);
	f.run("git", ["init", "--bare", "-b", "main", "remote.git"]);
	f.run("git", ["config", "status.showUntrackedFiles", "normal"]);
	f.write(".git/info/exclude", "remote.git/\n");
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
