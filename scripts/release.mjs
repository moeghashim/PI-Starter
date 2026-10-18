#!/usr/bin/env node

// Prepares a release as a pull request: bumps versions on a release branch, validates, and commits.
// After the pull request merges, `npm run release:tag` tags main and optionally publishes.

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

import {
	abort,
	changelogPaths,
	ensureCleanMainMatchingOrigin,
	readReleaseVersion,
	run,
	tagExistsLocally,
} from "./release-lib.mjs";

const VALID_BUMPS = new Set(["patch", "minor", "major"]);
const UNRELEASED_HEADING = "## [Unreleased]";

function usage() {
	console.error('Usage: npm run release:<patch|minor|major> -- --learning "<text>"');
}

function parseArgs(argv) {
	const [bump, flag, value, ...rest] = argv;
	if (!VALID_BUMPS.has(bump)) {
		usage();
		process.exit(1);
	}
	if (flag !== "--learning" || value === undefined || value.trim().length === 0 || rest.length > 0) {
		usage();
		abort("pass exactly one non-empty --learning value.");
	}
	return { bump, learning: value.trim() };
}

function ensureTagIsFree(tag) {
	const remote = spawnSync("git", ["ls-remote", "--exit-code", "--tags", "origin", `refs/tags/${tag}`]);
	if (remote.status === 0 || tagExistsLocally(tag)) {
		abort(`tag ${tag} already exists. Choose a different bump or remove the stale tag first.`);
	}
}

function startNewVersionSection(version) {
	const date = new Date().toISOString().split("T")[0];
	for (const path of changelogPaths()) {
		const content = readFileSync(path, "utf8");
		if (!content.includes(UNRELEASED_HEADING)) {
			abort(`${path} has no "${UNRELEASED_HEADING}" section.`);
		}
		writeFileSync(path, content.replace(UNRELEASED_HEADING, `${UNRELEASED_HEADING}\n\n## [${version}] - ${date}`));
	}
}

const { bump, learning } = parseArgs(process.argv.slice(2));
ensureCleanMainMatchingOrigin();

run("npm", ["run", `version:${bump}`]);
const version = readReleaseVersion();
const tag = `v${version}`;
ensureTagIsFree(tag);

const branch = `release/${tag}`;
run("git", ["switch", "-c", branch]);
startNewVersionSection(version);
run("node", [
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

for (const script of ["build", "check", "test", "agent:check", "fallow:audit"]) {
	run("npm", ["run", script]);
}

run("git", ["add", "--update"]);
run("git", ["commit", "--signoff", "-m", `chore(release): ${tag}`]);

console.log(`\nPrepared ${tag} on ${branch}. Push it through the gate:\n\n  git push no-mistakes ${branch}\n`);
console.log(
	"After the pull request merges, update main and run `npm run release:tag` (add `-- --publish` to publish).",
);
