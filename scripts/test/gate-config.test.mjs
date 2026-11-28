import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "yaml";

const root = new URL("../../", import.meta.url);
const workflow = parse(readFileSync(new URL(".github/workflows/ci.yml", root), "utf8"));

test("Fallow CI audits inline inside required-checks after pnpm install", () => {
	const steps = workflow.jobs["required-checks"].steps;
	const install = steps.findIndex((step) => step.run === "pnpm install --frozen-lockfile");
	const audit = steps.findIndex((step) => step.uses?.startsWith("fallow-rs/fallow@"));
	assert.ok(install >= 0 && audit > install);
	assert.equal(steps[audit].if, "github.event_name == 'pull_request'");
	assert.equal(steps[audit].with["no-cache"], true);
	assert.equal(workflow.jobs["fallow-audit"], undefined);
});

test("validation runs on ubuntu-latest without a matrix and gates upstream verification on path changes", () => {
	const validation = workflow.jobs["required-checks"];
	assert.equal(validation["runs-on"], "ubuntu-latest");
	assert.equal(validation.strategy, undefined);
	const upstream = validation.steps.find((step) => step.run === "pnpm run agent:verify-upstream");
	assert.ok(upstream);
	assert.equal(upstream.if, "needs.changes.outputs.upstream == 'true'");
});

test("web-builds is gated on relevant path changes and runs both Nitro and Cloudflare builds", () => {
	const webBuilds = workflow.jobs["web-builds"];
	assert.equal(webBuilds.if, "needs.changes.outputs.web == 'true'");
	const runs = webBuilds.steps.map((step) => step.run).filter(Boolean);
	assert.ok(runs.includes("pnpm install --frozen-lockfile"));
	assert.ok(runs.includes("pnpm --filter @pi-starter/web run build"));
	assert.ok(runs.includes("pnpm run build:cloudflare"));
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
	assert.equal(size.run, 'pnpm run pr:size -- "$PR_BASE" "$PR_HEAD"');
});

test("stable Required checks job requires every dependency to succeed, allowing skipped web-builds", () => {
	const job = Object.values(workflow.jobs).find(
		(candidate) => candidate.name === "Required checks" && !candidate.strategy,
	);
	assert.ok(job, "branch protection needs a non-matrix Required checks job");
	assert.equal(job.if, `\${{ always() }}`);
	assert.deepEqual(new Set(job.needs), new Set(["changes", "required-checks", "web-builds"]));
	assert.deepEqual(job.steps, [
		{
			name: "Require successful validation",
			if: `\${{ needs.changes.result != 'success' || needs.required-checks.result != 'success' || (needs.web-builds.result != 'success' && needs.web-builds.result != 'skipped') }}`,
			run: "exit 1",
		},
	]);
});
