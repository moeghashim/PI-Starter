#!/usr/bin/env node

// Tags a merged release on main and optionally publishes it. Run after the release pull request
// from `npm run release:<bump>` merges. Only the tag is pushed; main itself is never pushed here.

import { spawnSync } from "node:child_process";

import {
	abort,
	ensureCleanMainMatchingOrigin,
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

ensureCleanMainMatchingOrigin();

const tag = `v${readReleaseVersion()}`;
if (tagExistsLocally(tag)) {
	abort(`${tag} already exists. Merge a release pull request from \`npm run release:<bump>\` first.`);
}
const subject = `chore(release): ${tag}`;
const releaseCommit = git("log", "--no-walk", "--format=%H", "--fixed-strings", `--grep=${subject}`, "HEAD", "HEAD^@");
if (releaseCommit === "") {
	abort(`HEAD is not the merged "${subject}" commit. Merge the release pull request and tag it before main moves on.`);
}
if (publish) {
	const auth = spawnSync("npm", ["whoami"], { stdio: "ignore" });
	if (auth.status !== 0) {
		abort("--publish requires npm authentication. Run `npm login` first.");
	}
}

run("git", ["tag", "--annotate", tag, "--message", `Release ${tag}`]);
run("git", ["push", "origin", `refs/tags/${tag}`]);
console.log(`Tagged and pushed ${tag}.`);

if (!publish) {
	console.log("Skipping npm publish. Pass `-- --publish` to publish packages.");
	process.exit(0);
}
for (const pkg of publishablePackages()) {
	run("npm", ["publish", "--workspace", pkg.name, "--access", "public"]);
}
