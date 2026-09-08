#!/usr/bin/env node

import { execSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const VALID_BUMPS = new Set(["patch", "minor", "major"]);

function usage() {
	console.error('Usage: node scripts/release.mjs <patch|minor|major> --learning "<text>" [--publish] [--push]');
}

function parseArgs(argv) {
	const bump = argv[0];
	if (!VALID_BUMPS.has(bump)) {
		usage();
		process.exit(1);
	}

	let learning = "";
	let publish = false;
	let push = false;
	let index = 1;
	while (index < argv.length) {
		const arg = argv[index];
		if (arg === "--learning") {
			const value = argv[index + 1];
			if (value === undefined || value.trim().length === 0) {
				usage();
				console.error("Release aborted: --learning requires a non-empty value.");
				process.exit(1);
			}
			learning = value.trim();
			index += 2;
			continue;
		}
		if (arg === "--publish") {
			publish = true;
			index += 1;
			continue;
		}
		if (arg === "--push") {
			push = true;
			index += 1;
			continue;
		}

		usage();
		console.error(`Release aborted: unknown argument "${arg}".`);
		process.exit(1);
	}

	if (learning.length === 0) {
		usage();
		console.error("Release aborted: --learning is required.");
		process.exit(1);
	}

	return { bump, learning, publish, push };
}

const { bump, learning, publish, push } = parseArgs(process.argv.slice(2));

function run(command) {
	execSync(command, { stdio: "inherit", encoding: "utf8" });
}

function runArgs(command, args) {
	const result = spawnSync(command, args, { stdio: "inherit" });
	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}

function publishablePackages() {
	return readdirSync("packages")
		.map((packageName) => join("packages", packageName, "package.json"))
		.filter((path) => existsSync(path))
		.map((path) => JSON.parse(readFileSync(path, "utf8")))
		.filter((pkg) => pkg.private !== true)
		.map((pkg) => pkg.name);
}

function ensureCleanGitTree() {
	const status = execSync("git status --porcelain", { encoding: "utf8" });
	if (status.trim()) {
		console.error("Release aborted: uncommitted changes detected.");
		process.exit(1);
	}
}

function ensureNpmAuth() {
	try {
		execSync("npm whoami", { stdio: "ignore", encoding: "utf8" });
	} catch {
		console.error("Release aborted: --publish requires npm authentication. Run `npm login` first.");
		process.exit(1);
	}
}

function ensureReleaseBranch() {
	const branch = execSync("git branch --show-current", { encoding: "utf8" }).trim();
	if (branch !== "main") {
		console.error("Release aborted: switch to main before releasing.");
		process.exit(1);
	}
	run("git fetch origin main");
	const head = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
	const upstream = execSync("git rev-parse FETCH_HEAD", { encoding: "utf8" }).trim();
	if (head !== upstream) {
		console.error("Release aborted: main must match origin/main. Reconcile local and remote commits first.");
		process.exit(1);
	}
}

function changelogPaths() {
	return readdirSync("packages")
		.map((packageName) => join("packages", packageName, "CHANGELOG.md"))
		.filter((path) => existsSync(path));
}

function readVersion() {
	const corePackage = JSON.parse(readFileSync("packages/core/package.json", "utf8"));
	return corePackage.version;
}

function moveUnreleasedToVersion(version) {
	const date = new Date().toISOString().split("T")[0];
	for (const path of changelogPaths()) {
		const content = readFileSync(path, "utf8");
		if (!content.includes("## [Unreleased]")) {
			continue;
		}
		writeFileSync(path, content.replace("## [Unreleased]", `## [${version}] - ${date}`));
	}
}

function addUnreleasedSection() {
	for (const path of changelogPaths()) {
		const content = readFileSync(path, "utf8");
		if (content.includes("## [Unreleased]")) {
			continue;
		}

		writeFileSync(path, content.replace(/^(# Changelog\n\n)/, "$1## [Unreleased]\n\n"));
	}
}

ensureCleanGitTree();
ensureReleaseBranch();
if (publish) {
	ensureNpmAuth();
}
run(`npm run version:${bump}`);

const version = readVersion();
moveUnreleasedToVersion(version);
runArgs("node", [
	"scripts/progress-log.mjs",
	"append",
	"--trigger",
	"deploy",
	"--learning",
	learning,
	"--bump",
	bump,
	"--version",
	version,
]);

run("npm run build");
run("npm run check");
run("npm test");
run("npm run agent:check");
run("npm run fallow:audit");

run("git add .");
run(`git commit -m "Release v${version}"`);
run(`git tag v${version}`);

if (publish) {
	for (const packageName of publishablePackages()) {
		runArgs("npm", ["publish", "-w", packageName, "--access", "public"]);
	}
} else {
	console.log("Skipping npm publish by default for starter releases. Pass --publish to publish packages.");
}

addUnreleasedSection();
run("git add .");
run('git commit -m "Add [Unreleased] section for next cycle"');
if (push) {
	run(`git push --atomic origin HEAD:refs/heads/main refs/tags/v${version}`);
} else {
	console.log("Skipping git push by default for starter releases. Pass --push to push main and the release tag.");
}
