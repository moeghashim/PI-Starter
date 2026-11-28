#!/usr/bin/env node

import { spawn } from "node:child_process";

const root = process.cwd();
const isPullRequest = process.env.GITHUB_EVENT_NAME === "pull_request";
const prBase = process.env.PR_BASE;

const tasks = [
	{ name: "build:packages", command: "pnpm", args: ["--filter", "./packages/*", "--if-present", "run", "build"] },
	{ name: "check", command: "pnpm", args: ["run", "check"] },
	{ name: "test", command: "pnpm", args: ["test"] },
	{ name: "agent:check", command: "pnpm", args: ["run", "agent:check"] },
];

if (isPullRequest) {
	tasks.push({
		name: "fallow:audit",
		command: "pnpm",
		args: ["exec", "fallow", "audit", "--changed-since", prBase || "origin/main", "--no-cache"],
	});
}

function runTask(task) {
	const startedAt = Date.now();
	return new Promise((resolve) => {
		const child = spawn(task.command, task.args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
		let output = "";
		child.stdout.on("data", (chunk) => {
			output += chunk;
		});
		child.stderr.on("data", (chunk) => {
			output += chunk;
		});
		child.on("error", (error) => {
			resolve({ ...task, code: 1, ms: Date.now() - startedAt, output: `${output}${error.message}\n` });
		});
		child.on("close", (code) => {
			resolve({ ...task, code: code ?? 1, ms: Date.now() - startedAt, output });
		});
	});
}

const results = await Promise.all(tasks.map(runTask));
let failed = false;

for (const result of results) {
	const seconds = (result.ms / 1000).toFixed(2);
	if (result.code !== 0) {
		failed = true;
		console.error(`\n[${result.name}] failed in ${seconds}s (exit ${result.code}):`);
		if (result.output.trim()) {
			console.error(result.output.trimEnd());
		}
	} else {
		console.log(`[${result.name}] passed in ${seconds}s`);
	}
}

if (failed) {
	process.exit(1);
}
