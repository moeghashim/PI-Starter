#!/usr/bin/env node

// Tags a merged release on main and optionally publishes it. Run after the release pull request
// from `npm run release:<bump>` merges. Only the tag is pushed; main itself is never pushed here.

import { spawnSync } from "node:child_process";

import {
	abort,
	ensureCleanCommitOnOriginMain,
	git,
	publishablePackages,
	readReleaseVersion,
	run,
	tagExistsLocally,
} from "./release-lib.mjs";

const args = process.argv.slice(2);
if (args.some((arg) => arg !== "--publish")) {
	console.error("Usage: npm run release:tag [-- --publish]");
	process.exit(1);
}
const publish = args.includes("--publish");

ensureCleanCommitOnOriginMain();

const tag = `v${readReleaseVersion()}`;
if (tagExistsLocally(tag)) {
	abort(`${tag} already exists. Merge a release pull request from \`npm run release:<bump>\` first.`);
}
const subject = `chore(release): ${tag}`;
const grep = `--grep=${subject}`;
const releaseCommit = git("log", "--first-parent", "--format=%H", "--fixed-strings", grep, "-n", "1", "HEAD");
if (releaseCommit === "") {
	abort(`main has no "${subject}" commit. Merge the release pull request first.`);
}
if (publish) {
	if (git("rev-parse", "HEAD") !== releaseCommit) {
		abort(`HEAD must be the release commit to --publish. Run \`git checkout ${releaseCommit}\`.`);
	}
	const auth = spawnSync("npm", ["whoami"], { stdio: "ignore" });
	if (auth.status !== 0) {
		abort("--publish requires npm authentication. Run `npm login` first.");
	}
}

run("git", ["tag", "--annotate", tag, "--message", `Release ${tag}`, releaseCommit]);
run("git", ["push", "origin", `refs/tags/${tag}`]);
console.log(`Tagged ${releaseCommit} as ${tag} and pushed the tag.`);

if (!publish) {
	console.log("Skipping npm publish. Pass `-- --publish` to publish packages.");
	process.exit(0);
}
for (const pkg of publishablePackages()) {
	run("npm", ["publish", "--workspace", pkg.name, "--access", "public"]);
}
