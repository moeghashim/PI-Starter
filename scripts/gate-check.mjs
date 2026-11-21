import { execFileSync, spawnSync } from "node:child_process";
import { globSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

const [mode, phase, extra] = process.argv.slice(2);
const git = (...args) => execFileSync("git", args, { encoding: "utf8" });
const manifest = (path) => JSON.parse(readFileSync(path, "utf8"));

function resolveBase(base) {
	if (!base) throw new Error("Pass the batch base branch.");
	const ref = base.startsWith("batch/") ? `refs/remotes/origin/${base}` : base;
	return git("rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`).trim();
}

function affectedWorkspaces(paths) {
	const { workspaces } = manifest("package.json");
	const packages = [...new Set(workspaces.flatMap((glob) => globSync(`${glob}/package.json`)))].sort();
	const workspacesByPath = packages.map((path) => ({ dir: dirname(path), ...manifest(path) }));
	const rootChange = paths.some(
		(path) => !workspacesByPath.some(({ dir }) => path.startsWith(`${dir}/`)) && !path.endsWith(".md"),
	);
	const affected = new Set(
		workspacesByPath.filter(({ dir }) => rootChange || paths.some((path) => path.startsWith(`${dir}/`))),
	);
	addDependents(affected, workspacesByPath);
	return { dirs: [...affected].map(({ dir }) => dir).sort(), rootChange };
}

function addDependents(affected, workspacesByPath) {
	for (const workspace of affected) {
		for (const candidate of workspacesByPath) {
			const dependencies = {
				...candidate.dependencies,
				...candidate.devDependencies,
				...candidate.peerDependencies,
			};
			if (Object.hasOwn(dependencies, workspace.name)) affected.add(candidate);
		}
	}
}

function light(base) {
	const sha = resolveBase(base);
	const paths = git("diff", "--name-only", "-z", "--no-renames", `${sha}...HEAD`, "--").split("\0").filter(Boolean);
	const { dirs, rootChange } = affectedWorkspaces(paths);
	const commands = [
		["run", "pr:size", "--", sha],
		["run", "preflight:native-deps"],
	];
	const lintPaths = rootChange ? ["."] : dirs;
	commands.push(...workspaceChecks(lintPaths, dirs));
	if (rootChange) commands.push(["run", "test:scripts"]);
	return commands;
}

function workspaceChecks(lintPaths, dirs) {
	const commands = [];
	if (lintPaths.length) commands.push(["exec", "--", "biome", "check", "--error-on-warnings", ...lintPaths]);
	if (dirs.length) {
		const flags = dirs.flatMap((dir) => ["-w", dir]);
		commands.push(["run", "build", "--if-present", ...flags], ["run", "test", "--if-present", ...flags]);
	}
	return commands;
}

const testCommands = [["test"], ["run", "test:e2e", "--if-present"]];
const lintCommands = [
	["run", "check"],
	["run", "agent:check"],
	["run", "fallow:audit"],
];
const full = () => [["run", "build"], ...lintCommands, ...testCommands];

function gateBase() {
	const configured = spawnSync("git", ["config", "--local", "--get", "pi-starter.batch-base"], { encoding: "utf8" });
	if (configured.status !== 0 && configured.status !== 1) throw new Error("Cannot read the gate's batch base.");
	return configured.stdout.trim();
}

function verifyBatchCheckout() {
	const batchHead = git("config", "--local", "--get", "pi-starter.batch-head").trim();
	if (git("rev-parse", "HEAD").trim() !== batchHead || git("status", "--porcelain") !== "") {
		throw new Error("The full gate changed the batch checkout. Abort this run and submit a fix branch to the batch.");
	}
}

function gate(phase) {
	const base = gateBase();
	if (phase === "format") return base ? [] : [["exec", "--", "biome", "format", "--write", "."]];
	if (phase === "test") return testCommands;
	return gateLint(base);
}

function gateLint(base) {
	if (base === "main") verifyBatchCheckout();
	return base.startsWith("batch/") ? light(base) : lintCommands;
}

const reservedCheck = (check) => (check !== "format" && gateBase() ? check : "");
const recordPass = (check, sha) => git("config", "--local", `pi-starter.batch-${check}-pass`, sha);

try {
	let commands;
	let check = "";
	if (mode === "light" && !extra) commands = light(phase);
	else if (mode === "full" && !phase) commands = full();
	else if (mode === "plan" && !extra && ["full", "light"].includes(phase)) {
		console.log(JSON.stringify(phase === "full" ? full() : gate("lint")));
	} else if (mode === "gate" && !extra && ["test", "lint", "format"].includes(phase)) {
		check = reservedCheck(phase);
		if (check) recordPass(check, "");
		commands = gate(phase);
	} else throw new Error("Usage: gate-check.mjs light [base] | full | gate test|lint|format | plan light|full");

	for (const args of commands ?? []) {
		const result = spawnSync("npm", args, { stdio: "inherit" });
		if (result.error) throw result.error;
		if (result.status !== 0) process.exit(result.status ?? 1);
	}
	if (check) recordPass(check, git("rev-parse", "HEAD").trim());
} catch (error) {
	console.error(error.message);
	process.exitCode = 1;
}
