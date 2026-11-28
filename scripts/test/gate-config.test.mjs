import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "yaml";

const root = new URL("../../", import.meta.url);
const workflow = parse(readFileSync(new URL(".github/workflows/ci.yml", root), "utf8"));

test("validation and web-builds start immediately with blobless checkouts and no upstream job wait", () => {
	assert.equal(workflow.jobs.changes, undefined);
	assert.equal(workflow.jobs["fallow-audit"], undefined);
	for (const jobName of ["required-checks", "web-builds"]) {
		const job = workflow.jobs[jobName];
		assert.equal(job.needs, undefined);
		assert.equal(job["runs-on"], "ubuntu-latest");
		assert.equal(job.strategy, undefined);
		const checkout = job.steps.find((step) => step.uses?.startsWith("actions/checkout@"));
		assert.equal(checkout.with["fetch-depth"], 0);
		assert.equal(checkout.with.filter, "blob:none");
	}
});

test("validation runs checks, tests, guardrails, and Fallow in parallel and gates upstream verify", () => {
	const steps = workflow.jobs["required-checks"].steps;
	const install = steps.findIndex((step) => step.run === "pnpm install --frozen-lockfile");
	const validate = steps.findIndex((step) => step.run === "pnpm run ci:validate");
	assert.ok(install >= 0 && validate > install);
	const upstream = steps.find((step) => step.run === "pnpm run agent:verify-upstream");
	assert.ok(upstream);
	assert.equal(upstream.if, "steps.changes.outputs.upstream == 'true'");
});

test("web-builds gates Nitro and Cloudflare builds on relevant path changes", () => {
	const steps = workflow.jobs["web-builds"].steps;
	const nitro = steps.find((step) => step.run === "pnpm --filter @pi-starter/web run build");
	const cf = steps.find((step) => step.run === "pnpm run build:cloudflare");
	assert.ok(nitro && cf);
	assert.equal(nitro.if, "steps.changes.outputs.run == 'true'");
	assert.equal(cf.if, "steps.changes.outputs.run == 'true'");
});

test("PR size is advisory and compares the exact base and head with full history", () => {
	const steps = workflow.jobs["required-checks"].steps;
	const size = steps.find((step) => step.name === "Warn about PR size");
	assert.equal(size.if, "github.event_name == 'pull_request'");
	assert.equal(size["continue-on-error"], true);
	assert.deepEqual(size.env, {
		PR_BASE: `\${{ github.event.pull_request.base.sha }}`,
		PR_HEAD: `\${{ github.event.pull_request.head.sha }}`,
	});
	assert.equal(size.run, 'pnpm run pr:size -- "$PR_BASE" "$PR_HEAD"');
});

test("stable Required checks job requires both required-checks and web-builds to succeed", () => {
	const job = Object.values(workflow.jobs).find(
		(candidate) => candidate.name === "Required checks" && !candidate.strategy,
	);
	assert.ok(job, "branch protection needs a non-matrix Required checks job");
	assert.equal(job.if, `\${{ always() }}`);
	assert.deepEqual(new Set(job.needs), new Set(["required-checks", "web-builds"]));
	assert.deepEqual(job.steps, [
		{
			name: "Require successful validation",
			if: `\${{ needs.required-checks.result != 'success' || needs.web-builds.result != 'success' }}`,
			run: "exit 1",
		},
	]);
});
