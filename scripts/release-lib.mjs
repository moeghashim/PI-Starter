import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

function packageDirectories() {
	return readdirSync("packages", { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && existsSync(join("packages", entry.name, "package.json")))
		.map((entry) => join("packages", entry.name));
}

export function changelogPaths() {
	return packageDirectories()
		.map((directory) => join(directory, "CHANGELOG.md"))
		.filter((path) => existsSync(path));
}

export function publishablePackages() {
	return packageDirectories()
		.map((directory) => JSON.parse(readFileSync(join(directory, "package.json"), "utf8")))
		.filter((pkg) => pkg.private !== true);
}

// Versions are lockstep (enforced by scripts/sync-versions.js), so any package carries the release version.
function firstPackageManifest() {
	const [first] = packageDirectories();
	if (!first) {
		throw new Error("No packages found under packages/.");
	}
	return join(first, "package.json");
}

export function readReleaseVersion() {
	return JSON.parse(readFileSync(firstPackageManifest(), "utf8")).version;
}

export function readReleaseVersionAt(ref) {
	return JSON.parse(git("show", `${ref}:${firstPackageManifest()}`)).version;
}

export function git(...args) {
	return execFileSync("git", args, { encoding: "utf8" }).trim();
}

export function run(command, args) {
	const result = spawnSync(command, args, { stdio: "inherit" });
	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}

export function abort(message) {
	console.error(`Release aborted: ${message}`);
	process.exit(1);
}

export function refExists(ref) {
	return spawnSync("git", ["rev-parse", "-q", "--verify", ref]).status === 0;
}

export function tagExistsLocally(tag) {
	return refExists(`refs/tags/${tag}`);
}

export function ensureCleanTree() {
	if (git("status", "--porcelain") !== "") {
		abort("uncommitted changes detected.");
	}
}

export function fetchOriginMain() {
	run("git", ["fetch", "origin", "main", "--tags"]);
}

// Releases start from a clean main that matches origin/main.
export function ensureCleanMainMatchingOrigin() {
	ensureCleanTree();
	if (git("branch", "--show-current") !== "main") {
		abort("switch to main before releasing.");
	}
	fetchOriginMain();
	if (git("rev-parse", "HEAD") !== git("rev-parse", "FETCH_HEAD")) {
		abort("main must match origin/main. Reconcile local and remote commits first.");
	}
}
