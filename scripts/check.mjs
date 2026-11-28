#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();
const binDir = join(root, "node_modules", ".bin");

const preflight = spawnSync(process.execPath, ["scripts/preflight-native-deps.mjs"], {
	cwd: root,
	stdio: "inherit",
});
if (preflight.status !== 0) {
	process.exit(preflight.status ?? 1);
}

const tasks = [
	{ name: "biome", command: join(binDir, "biome"), args: ["check", "--error-on-warnings", "."] },
	{ name: "file-length", command: process.execPath, args: ["scripts/check-file-length.mjs"] },
	{ name: "tsc:root", command: join(binDir, "tsc"), args: ["--noEmit"] },
	{ name: "tsc:web", command: join(binDir, "tsc"), args: ["-p", "apps/web/tsconfig.json"] },
	{ name: "tsc:web-tools", command: join(binDir, "tsc"), args: ["-p", "apps/web/tsconfig.tools.json"] },
];

function runTask(task) {
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
			resolve({ ...task, code: 1, output: `${output}${error.message}\n` });
		});
		child.on("close", (code) => {
			resolve({ ...task, code: code ?? 1, output });
		});
	});
}

const results = await Promise.all(tasks.map(runTask));
let failed = false;

for (const result of results) {
	if (result.code !== 0) {
		failed = true;
		console.error(`\n[${result.name}] failed (exit ${result.code}):`);
		if (result.output.trim()) {
			console.error(result.output.trimEnd());
		}
	} else if (result.output.trim()) {
		console.log(result.output.trimEnd());
	}
}

if (failed) {
	process.exit(1);
}
