import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "yaml";

const root = new URL("../../", import.meta.url);
const workflow = parse(readFileSync(new URL(".github/workflows/ci.yml", root), "utf8"));

test("Fallow CI audits without a framework build step", () => {
	const steps = workflow.jobs["fallow-audit"].steps;
	const install = steps.findIndex((step) => step.run === "npm ci");
	const audit = steps.findIndex((step) => step.uses?.startsWith("fallow-rs/fallow@"));
	assert.ok(install >= 0 && audit > install);
	assert.equal(steps[audit].with["no-cache"], true);
});

test("validation runs only on GitHub-hosted Ubuntu and verifies pinned upstream skills", () => {
	const validation = workflow.jobs["required-checks"];
	assert.deepEqual(validation.strategy.matrix.os, ["ubuntu-latest"]);
	const upstream = validation.steps.find((step) => step.run === "npm run agent:verify-upstream");
	assert.ok(upstream);
	assert.equal(upstream.if, undefined);
});

test("PR size is advisory and compares the exact base and head with full history", () => {
	const steps = workflow.jobs["required-checks"].steps;
	const checkout = steps.find((step) => step.uses?.startsWith("actions/checkout@"));
	const size = steps.find((step) => step.name === "Warn about PR size");
	assert.equal(checkout.with["fetch-depth"], 0);
	assert.equal(size.if, "github.event_name == 'pull_request'");
	assert.equal(size["continue-on-error"], true);
	assert.deepEqual(size.env, {
		PR_BASE: `\${{ github.event.pull_request.base.sha }}`,
		PR_HEAD: `\${{ github.event.pull_request.head.sha }}`,
	});
	assert.equal(size.run, 'npm run pr:size -- "$PR_BASE" "$PR_HEAD"');
});

test("stable Required checks job requires every dependency to succeed, allowing only a skipped Fallow audit", () => {
	const job = Object.values(workflow.jobs).find(
		(candidate) => candidate.name === "Required checks" && !candidate.strategy,
	);
	assert.ok(job, "branch protection needs a non-matrix Required checks job");
	assert.equal(job.if, `\${{ always() }}`);
	assert.deepEqual(new Set(job.needs), new Set(["required-checks", "web-builds", "fallow-audit"]));
	assert.deepEqual(job.steps, [
		{
			name: "Require successful validation",
			if: `\${{ needs.required-checks.result != 'success' || needs.web-builds.result != 'success' || (needs.fallow-audit.result != 'success' && needs.fallow-audit.result != 'skipped') }}`,
			run: "exit 1",
		},
	]);
});
