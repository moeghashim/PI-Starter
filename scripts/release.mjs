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

function bumpVersion(current, bump) {
	const parts = /^(\d+)\.(\d+)\.(\d+)$/.exec(current)?.slice(1).map(Number);
	if (!parts) {
		abort(`current version ${current} is not a plain major.minor.patch release version.`);
	}
	const [major, minor, patch] = parts;
	if (bump === "major") {
		return `${major + 1}.0.0`;
	}
	if (bump === "minor") {
		return `${major}.${minor + 1}.0`;
	}
	return `${major}.${minor}.${patch + 1}`;
}

function readUnreleasedChangelogs() {
	return changelogPaths().map((path) => {
		const content = readFileSync(path, "utf8");
		if (!content.includes(UNRELEASED_HEADING)) {
			abort(`${path} has no "${UNRELEASED_HEADING}" section.`);
		}
		return { path, content };
	});
}

function startNewVersionSection(changelogs, version) {
	const date = new Date().toISOString().split("T")[0];
	for (const { path, content } of changelogs) {
		writeFileSync(path, content.replace(UNRELEASED_HEADING, `${UNRELEASED_HEADING}\n\n## [${version}] - ${date}`));
	}
}

const { bump, learning } = parseArgs(process.argv.slice(2));
ensureCleanMainMatchingOrigin();

const version = bumpVersion(readReleaseVersion(), bump);
const tag = `v${version}`;
ensureTagIsFree(tag);
const changelogs = readUnreleasedChangelogs();

const branch = `release/${tag}`;
run("git", ["switch", "-c", branch]);
run("npm", ["run", `version:${bump}`]);
startNewVersionSection(changelogs, version);
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
