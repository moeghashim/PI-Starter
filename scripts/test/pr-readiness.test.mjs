import assert from "node:assert/strict";
import test from "node:test";
import { checkReadiness, github } from "../pr-readiness.mjs";

function fixture(overrides = {}) {
	const pr = {
		url: "https://github.com/example/repo/pull/1",
		state: "OPEN",
		isDraft: false,
		headRefOid: "head",
		baseRefName: "main",
		mergeStateStatus: "CLEAN",
		reviewDecision: "",
		reviews: [],
		statusCheckRollup: [
			{ name: "Required checks", status: "COMPLETED", conclusion: "SUCCESS" },
			{ context: "DCO", state: "SUCCESS" },
		],
		...overrides,
	};
	const calls = [];
	const read = (args) => {
		calls.push(args);
		return readFixture(pr, args);
	};
	return { pr, calls, read };
}

function readFixture(pr, args) {
	if (args[0] === "pr") return pr;
	if (args[1]?.includes("/check-runs?"))
		return [
			{
				check_runs: pr.statusCheckRollup
					.filter((c) => c.name)
					.map((c) => ({
						...c,
						status: c.status.toLowerCase(),
						conclusion: c.conclusion?.toLowerCase(),
						id: 1,
						head_sha: pr.headRefOid,
						app: { id: 1 },
					})),
			},
		];
	if (args[1]?.includes("/statuses?"))
		return [
			pr.statusCheckRollup
				.filter((c) => c.context)
				.map((c) => ({
					context: c.context,
					state: c.state.toLowerCase(),
				})),
		];
	if (args.includes("graphql"))
		return [
			{
				data: {
					repository: {
						pullRequest: {
							reviewThreads: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
						},
					},
				},
			},
		];
	const path = args[1];
	if (path.endsWith("/protection/required_status_checks")) return { contexts: ["Required checks", "DCO"] };
	if (path.includes("/rules/branches/")) return [[]];
	return { state: "open", draft: false, head: { sha: pr.headRefOid }, base: { sha: "base" } };
}

test("ready requires every configured check on the current head", () => {
	const f = fixture();
	assert.equal(checkReadiness("example/repo", "1", f.read).ready, true);
	f.pr.statusCheckRollup.pop();
	const result = checkReadiness("example/repo", "1", f.read);
	assert.equal(result.ready, false);
	assert.match(result.blockers.join(" "), /DCO.*missing/);
});

test("pending, failed, skipped, and stale check evidence cannot qualify", () => {
	for (const conclusion of ["FAILURE", "SKIPPED", "CANCELLED", null]) {
		const f = fixture();
		f.pr.statusCheckRollup[0].conclusion = conclusion;
		assert.equal(checkReadiness("example/repo", "1", f.read).ready, false);
	}
	const f = fixture();
	let reads = 0;
	const read = (args) => {
		const result = f.read(args);
		if (args[0] === "api" && args[1].endsWith("/pulls/1")) {
			reads += 1;
			return { ...result, head: { sha: reads === 1 ? "old" : "new" } };
		}
		return result;
	};
	assert.match(checkReadiness("example/repo", "1", read).blockers.join(" "), /changed/);
});

test("unresolved threads and requests for changes block readiness", () => {
	const f = fixture({ reviewDecision: "CHANGES_REQUESTED" });
	const read = (args) =>
		args.includes("graphql")
			? [
					{
						data: {
							repository: {
								pullRequest: {
									reviewThreads: {
										nodes: [
											{ isResolved: false, isOutdated: true, comments: { nodes: [{ url: "thread-url" }] } },
										],
										pageInfo: { hasNextPage: false },
									},
								},
							},
						},
					},
				]
			: f.read(args);
	const result = checkReadiness("example/repo", "1", read);
	assert.equal(result.ready, false);
	assert.match(result.blockers.join(" "), /thread-url/);
	assert.match(result.blockers.join(" "), /changes requested/i);
});

test("ruleset requirements and checks from another app remain blocking", () => {
	const f = fixture();
	const read = (args) =>
		args[1]?.includes("/rules/branches/")
			? [
					[
						{
							type: "required_status_checks",
							parameters: {
								required_status_checks: [{ context: "Security", integration_id: 12 }],
							},
						},
					],
				]
			: f.read(args);
	assert.match(checkReadiness("example/repo", "1", read).blockers.join(" "), /Security/);
});

test("ruleset requirements beyond the first page of rules remain blocking", () => {
	const f = fixture();
	const firstPage = Array.from({ length: 100 }, () => ({ type: "pull_request" }));
	const laterPage = [
		{
			type: "required_status_checks",
			parameters: { required_status_checks: [{ context: "Later page check" }] },
		},
	];
	const read = (args) => {
		if (!args[1]?.includes("/rules/branches/")) return f.read(args);
		return args.includes("--paginate") && args.includes("--slurp") ? [firstPage, laterPage] : firstPage;
	};
	const result = checkReadiness("example/repo", "1", read);
	assert.equal(result.ready, false);
	assert.match(result.blockers.join(" "), /Later page check missing/);
});

test("only explicit no-protection responses count as no classic requirements", () => {
	const path = "repos/example/repo/branches/main/protection/required_status_checks";
	const fail = (stderr) => () => ({ status: 1, stdout: "", stderr });
	for (const message of ["Branch not protected", "Required status checks not enabled"]) {
		assert.equal(github(["api", path], fail(`gh: ${message} (HTTP 404)\n`)), null);
	}
	for (const stderr of [
		"gh: Not Found (HTTP 404)\n",
		"gh: Resource not accessible by integration (HTTP 403)\n",
		"gh: Bad credentials (HTTP 401)\n",
	]) {
		assert.throws(() => github(["api", path], fail(stderr)), /HTTP 40[134]/);
	}
	assert.throws(
		() => github(["api", "repos/example/repo/pulls/1"], fail("gh: Branch not protected (HTTP 404)\n")),
		/HTTP 404/,
	);
	const ok = () => ({ status: 0, stdout: '{"contexts":["DCO"]}', stderr: "" });
	assert.deepEqual(github(["api", path], ok), { contexts: ["DCO"] });
});

test("an ambiguous classic protection 404 fails inspection instead of reporting blockers", () => {
	const f = fixture();
	const read = (args) =>
		args[1]?.endsWith("/protection/required_status_checks")
			? github(args, () => ({ status: 1, stdout: "", stderr: "gh: Not Found (HTTP 404)\n" }))
			: f.read(args);
	assert.throws(() => checkReadiness("example/repo", "1", read), /Not Found/);
});

test("freshness, draft status, and unknown merge state block readiness", () => {
	for (const overrides of [{ isDraft: true }, { mergeStateStatus: "BEHIND" }, { mergeStateStatus: "UNKNOWN" }]) {
		const f = fixture(overrides);
		assert.equal(checkReadiness("example/repo", "1", f.read).ready, false);
	}
});

test("no configured required checks is an explicit blocker", () => {
	const f = fixture();
	const read = (args) => (args[1]?.endsWith("/protection/required_status_checks") ? null : f.read(args));
	assert.equal(checkReadiness("example/repo", "1", read).ready, false);
});

test("a base update during inspection invalidates readiness", () => {
	const f = fixture();
	let count = 0;
	const read = (args) => {
		const value = f.read(args);
		if (args[1]?.endsWith("/pulls/1")) return { ...value, base: { sha: String(count++) } };
		return value;
	};
	assert.match(checkReadiness("example/repo", "1", read).blockers.join(" "), /base changed/);
});

test("check runs must belong to the inspected head and required app", () => {
	for (const change of [{ head_sha: "old" }, { app: { id: 2 } }]) {
		const f = fixture();
		const read = (args) => {
			if (args[1]?.endsWith("/protection/required_status_checks")) {
				return { checks: [{ context: "Required checks", app_id: 1 }] };
			}
			const value = f.read(args);
			if (args[1]?.includes("/check-runs?")) Object.assign(value[0].check_runs[0], change);
			return value;
		};
		assert.equal(checkReadiness("example/repo", "1", read).ready, false);
	}
});

test("a newer pending rerun supersedes an older success", () => {
	const f = fixture();
	const read = (args) => {
		const value = f.read(args);
		if (args[1]?.includes("/check-runs?")) {
			value[0].check_runs.push({ ...value[0].check_runs[0], id: 2, status: "queued", conclusion: null });
		}
		return value;
	};
	assert.equal(checkReadiness("example/repo", "1", read).ready, false);
});

test("paginated unresolved feedback is inspected and resolved threads allow readiness", () => {
	const f = fixture();
	let unresolved = true;
	const read = (args) =>
		args.includes("graphql")
			? [
					...f.read(args),
					{
						data: {
							repository: {
								pullRequest: {
									reviewThreads: {
										nodes: [{ isResolved: !unresolved, comments: { nodes: [{ url: "page-two-thread" }] } }],
									},
								},
							},
						},
					},
				]
			: f.read(args);
	assert.match(checkReadiness("example/repo", "1", read).blockers.join(" "), /page-two-thread/);
	unresolved = false;
	assert.equal(checkReadiness("example/repo", "1", read).ready, true);
});

test("reviewer approval supersedes their earlier request for changes", () => {
	const f = fixture({
		reviews: [
			{ author: { login: "reviewer" }, state: "CHANGES_REQUESTED" },
			{ author: { login: "reviewer" }, state: "COMMENTED" },
		],
	});
	assert.equal(checkReadiness("example/repo", "1", f.read).ready, false);
	f.pr.reviews.push({ author: { login: "reviewer" }, state: "APPROVED" });
	assert.equal(checkReadiness("example/repo", "1", f.read).ready, true);
});

test("inspection errors cannot produce a ready result", () => {
	const f = fixture();
	const read = (args) => {
		if (args.includes("graphql")) return [{ errors: [{ message: "rate limit" }] }];
		return f.read(args);
	};
	assert.throws(() => checkReadiness("example/repo", "1", read), /rate limit/);
});

test("closing the PR during inspection blocks readiness", () => {
	const f = fixture();
	let calls = 0;
	const read = (args) => {
		const result = f.read(args);
		if (args[1]?.endsWith("/pulls/1")) return { ...result, state: ++calls === 1 ? "open" : "closed" };
		return result;
	};
	assert.match(checkReadiness("example/repo", "1", read).blockers.join(" "), /closed/);
});
