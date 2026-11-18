import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const THREAD_QUERY = `query($owner: String!, $name: String!, $number: Int!, $endCursor: String) {
	repository(owner: $owner, name: $name) {
		pullRequest(number: $number) {
			reviewThreads(first: 100, after: $endCursor) {
				nodes { isResolved comments(first: 1) { nodes { url } } }
				pageInfo { hasNextPage endCursor }
			}
		}
	}
}`;

export function github(args, run = spawnSync) {
	const result = run("gh", args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
	// An unprotected branch has no classic protection requirements. Rulesets are checked separately.
	if (
		result.status !== 0 &&
		args[1]?.endsWith("/protection/required_status_checks") &&
		/\b(Branch not protected|Required status checks not enabled) \(HTTP 404\)/.test(result.stderr)
	) {
		return null;
	}
	if (result.status !== 0) throw new Error(result.stderr || result.error?.message || "GitHub query failed");
	return JSON.parse(result.stdout);
}

function readEvidence(repo, number, pr, read) {
	const [owner, name] = repo.split("/");
	const api = (path) => read(["api", `repos/${repo}/${path}`]);
	const base = encodeURIComponent(pr.baseRefName);
	const classic = api(`branches/${base}/protection/required_status_checks`);
	const rules = read(["api", `repos/${repo}/rules/branches/${base}?per_page=100`, "--paginate", "--slurp"]).flat();
	const required = [
		...(classic?.checks ?? classic?.contexts?.map((context) => ({ context })) ?? []),
		...rules
			.filter((rule) => rule.type === "required_status_checks")
			.flatMap((rule) => rule.parameters.required_status_checks)
			.map((check) => ({ context: check.context, app_id: check.integration_id })),
	];
	const checkPages = read([
		"api",
		`repos/${repo}/commits/${pr.headRefOid}/check-runs?per_page=100`,
		"--paginate",
		"--slurp",
	]);
	const statusPages = read([
		"api",
		`repos/${repo}/commits/${pr.headRefOid}/statuses?per_page=100`,
		"--paginate",
		"--slurp",
	]);
	const checks = checkPages.flatMap((page) => page.check_runs);
	const statuses = statusPages.flat();
	const threadPages = read([
		"api",
		"graphql",
		"--paginate",
		"--slurp",
		"-f",
		`query=${THREAD_QUERY}`,
		"-f",
		`owner=${owner}`,
		"-f",
		`name=${name}`,
		"-F",
		`number=${number}`,
	]);
	const threads = threadPages.flatMap((page) => {
		if (page.errors) throw new Error(JSON.stringify(page.errors));
		return page.data.repository.pullRequest.reviewThreads.nodes;
	});

	return { required, checks, statuses, threads };
}

function reviewBlockers(pr, threads) {
	const blockers = [];
	if (pr.state !== "OPEN") blockers.push(`PR is ${pr.state}`);
	if (pr.isDraft) blockers.push("PR is a draft");
	if (pr.mergeStateStatus !== "CLEAN") blockers.push(`Merge state is ${pr.mergeStateStatus}`);
	const reviewStatus = {
		CHANGES_REQUESTED: "Changes requested by review",
		REVIEW_REQUIRED: "Required review is pending",
	}[pr.reviewDecision];
	if (reviewStatus) blockers.push(reviewStatus);
	blockers.push(...reviewRequests(pr.reviews));
	for (const thread of threads) {
		if (!thread.isResolved) blockers.push(`Unresolved review thread ${thread.comments.nodes[0]?.url ?? ""}`);
	}
	return blockers;
}

function reviewRequests(reviews) {
	// Keep each reviewer's latest decision, including requests that predate the current head.
	const decisions = new Map();
	for (const review of reviews) {
		if (["APPROVED", "CHANGES_REQUESTED", "DISMISSED"].includes(review.state)) {
			decisions.set(review.author?.login ?? review.id, review.state);
		}
	}
	return [...decisions]
		.filter(([, state]) => state === "CHANGES_REQUESTED")
		.map(([author]) => `Changes requested by ${author}`);
}

function requiredCheck(requirement, checks, statuses, head) {
	const runs = latestRuns(requirement, checks);
	const status = statuses.find((item) => item.context === requirement.context);
	const passed =
		runs.length > 0
			? runs.every((run) => run.head_sha === head && run.status === "completed" && run.conclusion === "success")
			: [undefined, null, 0, -1].includes(requirement.app_id) && status?.state === "success";
	let state = "missing";
	if (runs.length || status) state = "pending or unsuccessful";
	if (passed) state = "passed";
	return { name: requirement.context, app: requirement.app_id ?? null, state };
}

function latestRuns(requirement, checks) {
	const anyApp = [undefined, null, 0, -1].includes(requirement.app_id);
	const matching = checks.filter(
		(check) => check.name === requirement.context && (anyApp || check.app.id === requirement.app_id),
	);
	const latest = new Map();
	for (const check of matching.toSorted((a, b) => a.id - b.id)) latest.set(check.app.id, check);
	return [...latest.values()];
}

export function checkReadiness(repo, number, read = github) {
	if (!/^[^/]+\/[^/]+$/.test(repo) || !/^\d+$/.test(number)) {
		throw new Error("Expected owner/repo and a PR number");
	}
	const api = (path) => read(["api", `repos/${repo}/${path}`]);
	const before = api(`pulls/${number}`);
	const pr = read([
		"pr",
		"view",
		number,
		"--repo",
		repo,
		"--json",
		"url,state,isDraft,headRefOid,baseRefName,mergeStateStatus,reviewDecision,reviews",
	]);
	const { required, checks, statuses, threads } = readEvidence(repo, number, pr, read);
	const blockers = reviewBlockers(pr, threads);
	if (required.length === 0) blockers.push("No required checks configured");
	const results = required.map((requirement) => requiredCheck(requirement, checks, statuses, pr.headRefOid));
	for (const result of results) {
		if (result.state !== "passed") blockers.push(`${result.name} ${result.state}`);
	}
	const after = api(`pulls/${number}`);
	if (after.state !== "open" || after.draft) blockers.push("PR closed or became a draft during inspection");
	if (before.head.sha !== pr.headRefOid || after.head.sha !== pr.headRefOid || before.base.sha !== after.base.sha) {
		blockers.push("PR head or base changed during inspection; run the check again");
	}
	return { ready: blockers.length === 0, url: pr.url, head: pr.headRefOid, checks: results, blockers };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	try {
		const [number, repo] = process.argv.slice(2);
		const result = checkReadiness(
			repo ?? github(["repo", "view", "--json", "nameWithOwner"]).nameWithOwner,
			number ?? "",
		);
		console.log(JSON.stringify(result, null, 2));
		process.exitCode = result.ready ? 0 : 1;
	} catch (error) {
		console.error(error.message);
		process.exitCode = 2;
	}
}
