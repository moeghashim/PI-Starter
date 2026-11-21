import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const batchName = /^batch\/([1-9]\d*)$/;
const shaPattern = /^[a-f0-9]{40,64}$/;
const terminal = new Set(["completed", "failed", "cancelled", "checks_passed", "handed_off", "ci_monitor_interrupted"]);
const prFields = "number,state,baseRefName,headRefName,headRefOid,isCrossRepository,url";
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const gh = (...args) => JSON.parse(execFileSync("gh", args, { encoding: "utf8" }));
const prs = (branch, state) =>
	gh("pr", "list", "--base", branch, "--state", state, "--limit", "1000", "--json", prFields);
const noRunDiagnostic = "error: no run found for this branch";
const reservationCommands = new Set(["resume", "release"]);
const origin = (name) => `refs/remotes/origin/${name}`;
const isBatch = ({ headRefName, isCrossRepository }) => !isCrossRepository && batchName.test(headRefName);

function openBatch() {
	const open = prs("main", "open").filter(isBatch);
	if (open.length > 1) throw new Error("More than one batch PR is open. Resolve that before running the batch gate.");
	return open[0]?.headRefName;
}

function batchNumber({ headRefName }) {
	return Number(batchName.exec(headRefName)[1]);
}

function queue() {
	const active = openBatch();
	const newest = active
		? batchNumber({ headRefName: active })
		: Math.max(0, ...prs("main", "merged").filter(isBatch).map(batchNumber));
	return { next: `batch/${newest + 1}`, oldest: active ?? `batch/${newest + 1}` };
}

function fetchBranch(branch) {
	git("fetch", "--no-tags", "origin", `+refs/heads/${branch}:${origin(branch)}`);
	return git("rev-parse", origin(branch));
}

function ensureBatch(base) {
	if (!git("ls-remote", "--heads", "origin", `refs/heads/${base}`)) {
		const sha = fetchBranch("main");
		gh("api", "repos/{owner}/{repo}/git/refs", "-f", `ref=refs/heads/${base}`, "-f", `sha=${sha}`);
	}
	fetchBranch(base);
}

function gateStatus() {
	const { error, status, stdout } = spawnSync("no-mistakes", ["axi", "status"], { encoding: "utf8" });
	if (error) throw error;
	if (stdout.startsWith(noRunDiagnostic)) return "";
	assertGateStatus(status, stdout);
	return stdout;
}

function assertGateStatus(status, stdout) {
	if (status !== 0 || stdout.startsWith("error:")) {
		throw new Error(stdout.trim() || "no-mistakes axi status failed.");
	}
}

function readGate() {
	const run = /^run:\n((?:^ {2}[^\n]+\n)+)/m.exec(gateStatus())?.[1] ?? "";
	const field = (name) => new RegExp(`^  ${name}: "?([^"\\n]+)"?$`, "m").exec(run)?.[1];
	const completed = (step) => new RegExp(`^    ${step},completed,`, "m").test(run);
	return { id: field("id"), status: field("status"), sha: field("head_sha"), completed };
}

function reserve(gateDir, base, head) {
	const values = { "batch-base": base, "batch-head": head, "batch-lint-pass": "", "batch-test-pass": "" };
	for (const [key, value] of Object.entries(values)) {
		git("--git-dir", gateDir, "config", "--local", `pi-starter.${key}`, value);
	}
}

function clearReservation(gateDir, opFile) {
	reserve(gateDir, "", "");
	rmSync(opFile);
}

function stepsCompleted(status, checks) {
	return (
		status.status === "completed" &&
		shaPattern.test(status.sha) &&
		["review", "push", "pr", ...checks].every(status.completed)
	);
}

function proven(gateDir, check, sha) {
	const key = `pi-starter.batch-${check}-pass`;
	return git("--git-dir", gateDir, "config", "--local", "--default", "", "--get", key) === sha;
}

function passed(gateDir, status, mode) {
	const checks = mode === "publish" ? ["lint", "test"] : ["lint"];
	return stepsCompleted(status, checks) && checks.every((check) => proven(gateDir, check, status.sha));
}

function finish(gateDir, opFile, operation, status) {
	if (!passed(gateDir, status, operation.mode)) {
		clearReservation(gateDir, opFile);
		throw new Error(
			"The gate did not complete all required steps with passing checks. Inspect no-mistakes axi status before retrying.",
		);
	}

	const dir = join(gateDir, "pi-starter-receipts");
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, status.sha), JSON.stringify(operation), { mode: 0o600 });
	clearReservation(gateDir, opFile);
	console.log(
		operation.mode === "publish"
			? "Batch PR published. Wait for required GitHub CI, then use batch merge."
			: "Task PR passed review and light checks. Use batch merge to add it to the batch.",
	);
}

function observe(gateDir, opFile, operation, status) {
	if (status.id === operation.previous || !terminal.has(status.status)) return false;
	finish(gateDir, opFile, operation, status);
	return true;
}

function launchArgs(operation, intent, status) {
	const args = ["axi", "run", "--wait", "45s"];
	if (intent) {
		const skips = operation.mode === "publish" ? "rebase,ci" : "test,document,ci";
		return [...args, "--intent-file", intent, "--base-branch", operation.base, "--skip", skips];
	}
	if (status.id === operation.previous) {
		throw new Error("No run was recorded. Check AXI status and use batch release to clear the reservation.");
	}
	return args;
}

function runGate(args) {
	const result = spawnSync("no-mistakes", args, { stdio: "inherit" });
	if (result.error) throw result.error;
}

function drive(gateDir, opFile, operation, intent) {
	const status = readGate();
	if (observe(gateDir, opFile, operation, status)) return;
	runGate(launchArgs(operation, intent, status));
	const after = readGate();
	if (observe(gateDir, opFile, operation, after)) return;
	if (after.id === operation.previous)
		throw new Error("The launch did not record a run. Use batch release after checking AXI status.");
	console.log("Batch gate reserved. Handle the AXI decision if needed, then run npm run batch -- resume.");
}

function requireAncestor(from, to, message) {
	if (spawnSync("git", ["merge-base", "--is-ancestor", from, to]).status !== 0) throw new Error(message);
}

function batchBase(branch, oldest) {
	if (branch !== oldest) throw new Error(`Switch to ${oldest} before publishing a batch.`);
	ensureBatch(branch);
	requireAncestor(
		origin(branch),
		"HEAD",
		"Update the local batch branch to its remote tip without rewriting history.",
	);
	const main = fetchBranch("main");
	requireAncestor(main, "HEAD", "Merge origin/main into the local batch branch before publishing.");
	if (git("rev-list", "--no-merges", "HEAD", `^${origin(branch)}`, `^${main}`)) {
		throw new Error("Submit new changes on a task or repair branch before publishing the batch.");
	}
	if (prs(branch, "open").length) throw new Error("Merge or close outstanding task PRs before publishing this batch.");
	return "main";
}

function validateTaskBranch(branch) {
	if (batchName.test(branch) || branch === "main") throw new Error("Switch to a task branch first.");
	const prior = gh("pr", "list", "--head", branch, "--state", "all", "--limit", "100", "--json", prFields);
	if (prior.some(({ state }) => state === "MERGED")) throw new Error("Use a new branch for follow-up work.");
}

function taskBase(branch, mode, { oldest, next }) {
	validateTaskBranch(branch);
	const base = mode === "repair" ? oldest : next;
	ensureBatch(base);
	return base;
}

function start(gateDir, opFile, { mode, branch, intent }) {
	const current = queue();
	const base = mode === "publish" ? batchBase(branch, current.oldest) : taskBase(branch, mode, current);
	if (mode === "repair") requireAncestor(origin(base), "HEAD", `Create the fix branch from the current ${base} head.`);
	const operation = { mode, base, branch, previous: readGate().id };
	writeFileSync(opFile, JSON.stringify(operation), { flag: "wx", mode: 0o600 });
	reserve(gateDir, base, base === "main" ? git("rev-parse", "HEAD") : "");
	drive(gateDir, opFile, operation, resolve(intent));
}

function receiptFor(gateDir, { headRefOid: sha, baseRefName: base, headRefName: branch }) {
	const receiptPath = join(gateDir, "pi-starter-receipts", sha);
	if (!existsSync(receiptPath)) throw new Error("There is no passing batch gate receipt for the current PR head.");
	const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
	if (receipt.base !== base || receipt.branch !== branch) throw new Error("The gate receipt targets a different PR.");
	return { ...receipt, sha };
}

function checkTaskMerge({ mode, base, branch, sha }) {
	const { oldest, next } = queue();
	if (base !== (mode === "repair" ? oldest : next))
		throw new Error("The PR no longer targets a batch that accepts this kind of task.");
	const tip = fetchBranch(base);
	if (fetchBranch(branch) !== sha) throw new Error("The PR head moved during inspection.");
	requireAncestor(tip, sha, "The batch moved after review. Run the light gate again against its latest head.");
}

function checkBatchMerge({ branch, sha }, number) {
	if (openBatch() !== branch) throw new Error("Only the open batch PR can merge to main.");
	if (fetchBranch(branch) !== sha) throw new Error("The batch PR head moved during inspection.");
	requireAncestor(
		fetchBranch("main"),
		sha,
		"Main moved after the batch was validated. Merge main into the batch and publish again.",
	);
	execFileSync("npm", ["run", "pr:ready", "--", number], { stdio: "inherit" });
}

function readOpenPR(number) {
	const pr = gh("pr", "view", number, "--json", prFields);
	if (pr.state !== "OPEN" || pr.isCrossRepository || !shaPattern.test(pr.headRefOid))
		throw new Error("Expected an open PR from this repository.");
	return pr;
}

function merge(gateDir, number) {
	if (!/^\d+$/.test(number ?? "")) throw new Error("Supply a PR number.");
	const receipt = receiptFor(gateDir, readOpenPR(number));
	if (receipt.mode === "publish") checkBatchMerge(receipt, number);
	else checkTaskMerge(receipt);
	execFileSync("gh", ["pr", "merge", number, "--merge", "--match-head-commit", receipt.sha], { stdio: "inherit" });
}

function continueGate(gateDir, opFile, op, { command, branch }) {
	if (op.branch !== branch || !reservationCommands.has(command))
		throw new Error(`The gate is reserved by ${op.branch}. Finish its AXI run and resume on that branch.`);
	if (command === "resume") return drive(gateDir, opFile, op);
	release(gateDir, opFile, op);
}

function release(gateDir, opFile, op) {
	const status = readGate();
	if (status.id && !terminal.has(status.status)) throw new Error("Cannot release a gate while its run is active.");
	if (!observe(gateDir, opFile, op, status)) clearReservation(gateDir, opFile);
}

function ensureIdle() {
	const home = execFileSync("no-mistakes", ["axi"], { encoding: "utf8" });
	if (/^(?:error|active_run|other_branch_active_run):/m.test(home))
		throw new Error(
			"The gate is unavailable or has an active run outside this batch workflow. Inspect no-mistakes axi.",
		);
}

function showTarget(value) {
	if (value && value !== "repair") throw new Error("Usage: npm run batch -- target [repair]");
	const { oldest, next } = queue();
	const base = value === "repair" ? oldest : next;
	ensureBatch(base);
	console.log(base);
}

function checkIntent(value) {
	if (!value || !readFileSync(resolve(value), "utf8").trim())
		throw new Error("Supply an intent file before running the batch gate.");
}

function launch(gateDir, opFile, { command, value, branch }) {
	checkIntent(value);
	if (!branch) throw new Error("Switch to a branch before running the batch gate.");
	if (git("status", "--porcelain")) throw new Error("Commit your work before running the batch gate.");
	start(gateDir, opFile, { mode: command, branch, intent: value });
}

function validateArgumentCount(extra) {
	if (extra) throw new Error("Too many batch command arguments.");
}

function operate(gateDir, opFile) {
	const [command, value, extra] = process.argv.slice(2);
	const args = { command, value, branch: git("branch", "--show-current") };
	validateArgumentCount(extra);
	if (existsSync(opFile)) return continueGate(gateDir, opFile, JSON.parse(readFileSync(opFile, "utf8")), args);
	if (reservationCommands.has(command)) return console.log(`No reservation to ${command}.`);
	ensureIdle();
	return dispatch(gateDir, opFile, args);
}

function dispatch(gateDir, opFile, args) {
	const { command, value } = args;
	const commands = {
		target: () => showTarget(value),
		task: () => launch(gateDir, opFile, args),
		repair: () => launch(gateDir, opFile, args),
		publish: () => launch(gateDir, opFile, args),
		merge: () => merge(gateDir, value),
	};
	if (!Object.hasOwn(commands, command)) {
		throw new Error(
			"Usage: npm run batch -- target [repair] | task|repair|publish <intent-file> | resume | release | merge <PR>",
		);
	}
	commands[command]();
}

try {
	const gateDir = resolve(git("remote", "get-url", "no-mistakes"));
	if (git("--git-dir", gateDir, "rev-parse", "--is-bare-repository") !== "true")
		throw new Error("Expected a local no-mistakes gate.");
	const mutex = join(gateDir, "pi-starter-batch.lock");
	try {
		mkdirSync(mutex);
	} catch (error) {
		if (error.code === "EEXIST") throw new Error("Another batch command holds the gate lock.");
		throw error;
	}
	try {
		operate(gateDir, join(gateDir, "pi-starter-batch.json"));
	} finally {
		rmSync(mutex, { recursive: true });
	}
} catch (error) {
	console.error(error.message);
	process.exitCode = 1;
}
