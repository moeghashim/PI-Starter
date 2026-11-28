#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

function fail(message) {
	console.error(`init:project: ${message}`);
	process.exit(1);
}

function toTitle(slug) {
	return slug
		.split("-")
		.filter(Boolean)
		.map((part) => part[0].toUpperCase() + part.slice(1))
		.join(" ");
}

const { values } = parseArgs({
	args: process.argv.slice(2),
	options: {
		name: { type: "string" },
		scope: { type: "string" },
		title: { type: "string" },
		"skip-progress": { type: "boolean", default: false },
	},
});

const name = values.name?.trim();
if (!name || !/^[a-z0-9][a-z0-9-]*$/.test(name)) {
	fail("pass a lowercase slug via --name (for example: pnpm run init:project -- --name my-saas).");
}

const scope = (values.scope?.trim() || `@${name}`).replace(/^@?/, "@");
if (!/^@[a-z0-9][a-z0-9-]*$/.test(scope)) {
	fail(`invalid --scope "${scope}". Expected format like @my-saas.`);
}

const title = values.title?.trim() || toTitle(name);
const root = process.cwd();

const replacements = [
	[
		"package.json",
		[
			['"pi-starter"', `"${name}"`],
			["@pi-starter/web", `${scope}/web`],
		],
	],
	["packages/core/package.json", [['"@pi-starter/core"', `"${scope}/core"`]]],
	[
		"apps/web/package.json",
		[
			['"@pi-starter/web"', `"${scope}/web"`],
			['"@pi-starter/core"', `"${scope}/core"`],
		],
	],
	["tsconfig.json", [['"@pi-starter/*"', `"${scope}/*"`]]],
	["apps/web/tsconfig.json", [['"@pi-starter/core"', `"${scope}/core"`]]],
	["apps/web/wrangler.jsonc", [['"pi-starter-web"', `"${name}-web"`]]],
	["apps/web/src/routes/__root.tsx", [['title: "PI-Starter"', `title: "${title}"`]]],
	[
		"apps/web/src/routes/index.tsx",
		[
			['from "@pi-starter/core"', `from "${scope}/core"`],
			["PI-Starter", title],
		],
	],
	["apps/web/test/home.test.ts", [["PI-Starter", title]]],
	[".github/workflows/ci.yml", [["@pi-starter/web", `${scope}/web`]]],
];

const changed = [];
for (const [relativePath, pairs] of replacements) {
	const fullPath = join(root, relativePath);
	if (!existsSync(fullPath)) {
		continue;
	}
	const original = readFileSync(fullPath, "utf8");
	let updated = original;
	for (const [from, to] of pairs) {
		updated = updated.replaceAll(from, to);
	}
	if (updated !== original) {
		writeFileSync(fullPath, updated);
		changed.push(relativePath);
	}
}

if (!values["skip-progress"] && existsSync(join(root, "scripts/progress-log.mjs"))) {
	const log = spawnSync(
		process.execPath,
		[
			"scripts/progress-log.mjs",
			"append",
			"--trigger",
			"commit",
			"--learning",
			`Initialized ${title} (${name}) from PI-Starter.`,
			"--message",
			`chore(init): rename starter to ${name}`,
		],
		{ cwd: root, stdio: "inherit" },
	);
	if (log.status !== 0) {
		process.exit(log.status ?? 1);
	}
	changed.push("progress.md");
}

console.log(`Initialized ${title} (${name}, scope ${scope}). Updated ${changed.length} files.`);
