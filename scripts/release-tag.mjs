#!/usr/bin/env node

// Tags the latest merged release on origin/main and optionally publishes it. Run after the release
// pull request from `npm run release:<bump>` merges. Only the tag is pushed; main itself is never
// pushed here. Every step is idempotent, so a failed run can be resumed by rerunning.

import { spawnSync } from "node:child_process";

import {
	abort,
	ensureCleanTree,
	fetchOriginMain,
	git,
	publishablePackages,
	readReleaseVersionAt,
	run,
	tagExistsLocally,
} from "./release-lib.mjs";

const RELEASE_SUBJECT = "chore\\(release\\): v[0-9]+\\.[0-9]+\\.[0-9]+";

const args = process.argv.slice(2);
if (args.some((arg) => arg !== "--publish")) {
	console.error("Usage: npm run release:tag [-- --publish]");
	process.exit(1);
}
const publish = args.includes("--publish");

function isPublished(name, version) {
	const view = spawnSync("npm", ["view", `${name}@${version}`, "version"], { encoding: "utf8" });
	return view.status === 0 && view.stdout.trim() === version;
}

ensureCleanTree();
fetchOriginMain();

const grep = `--grep=${RELEASE_SUBJECT}`;
const releaseCommit = git("log", "--first-parent", "--format=%H", "--extended-regexp", grep, "-n", "1", "FETCH_HEAD");
if (releaseCommit === "") {
	abort("origin/main has no chore(release) commit. Merge the release pull request first.");
}
const version = readReleaseVersionAt(releaseCommit);
const tag = `v${version}`;

if (publish) {
	if (git("rev-parse", "HEAD") !== releaseCommit) {
		abort(`HEAD must be the release commit to --publish. Run \`git checkout ${releaseCommit}\`.`);
	}
	const auth = spawnSync("npm", ["whoami"], { stdio: "ignore" });
	if (auth.status !== 0) {
		abort("--publish requires npm authentication. Run `npm login` first.");
	}
}

if (tagExistsLocally(tag)) {
	const taggedCommit = git("rev-list", "-n", "1", tag);
	if (taggedCommit !== releaseCommit) {
		abort(`${tag} points at ${taggedCommit}, not the release commit ${releaseCommit}. Remove the stale tag first.`);
	}
	console.log(`${tag} already points at ${releaseCommit}.`);
} else {
	run("git", ["tag", "--annotate", tag, "--message", `Release ${tag}`, releaseCommit]);
	console.log(`Tagged ${releaseCommit} as ${tag}.`);
}

const remoteTag = spawnSync("git", ["ls-remote", "--exit-code", "--tags", "origin", `refs/tags/${tag}`]);
if (remoteTag.status === 0) {
	console.log(`origin already has ${tag}.`);
} else {
	run("git", ["push", "origin", `refs/tags/${tag}`]);
	console.log(`Pushed ${tag}.`);
}

if (!publish) {
	console.log("Skipping npm publish. Pass `-- --publish` to publish packages.");
	process.exit(0);
}
for (const pkg of publishablePackages()) {
	if (isPublished(pkg.name, version)) {
		console.log(`${pkg.name}@${version} is already published.`);
		continue;
	}
	run("npm", ["publish", "--workspace", pkg.name, "--access", "public"]);
}
