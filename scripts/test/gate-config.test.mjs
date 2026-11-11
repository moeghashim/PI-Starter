import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "yaml";

const root = new URL("../../", import.meta.url);
const gate = parse(readFileSync(new URL(".no-mistakes.yaml", root), "utf8"));
const workflow = parse(readFileSync(new URL(".github/workflows/ci.yml", root), "utf8"));

test("Fallow CI prepares generated Next.js types before auditing a clean checkout", () => {
	const steps = workflow.jobs["fallow-audit"].steps;
	const install = steps.findIndex((step) => step.run === "npm ci");
	const typegen = steps.findIndex((step) => step.run === "npm exec -w @pi-starter/web -- next typegen");
	const audit = steps.findIndex((step) => step.uses?.startsWith("fallow-rs/fallow@"));
	assert.ok(install >= 0 && typegen > install && audit > typegen);
	assert.equal(steps[audit].with["no-cache"], true);
});

test("gate commands reach npm with the .nvmrc Node on PATH and no nvm", () => {
	for (const command of [gate.commands.test, gate.commands.lint]) {
		// Replace npm at the shell boundary to avoid installing during this test.
		const result = spawnSync("sh", ["-c", `npm() { exit 42; }; ${command}`], {
			cwd: root,
			env: { ...process.env, NVM_DIR: "/nonexistent-pi-starter-nvm" },
			encoding: "utf8",
		});
		assert.equal(result.status, 42, result.stderr);
	}
});

test("stable Required checks job fails on any failed or cancelled dependency", () => {
	const job = Object.values(workflow.jobs).find(
		(candidate) => candidate.name === "Required checks" && !candidate.strategy,
	);
	assert.ok(job, "branch protection needs a non-matrix Required checks job");
	assert.equal(job.if, `\${{ always() }}`);
	assert.deepEqual(new Set(job.needs), new Set(["required-checks", "cloudflare-build", "fallow-audit"]));
	assert.deepEqual(job.steps, [
		{
			name: "Require successful validation",
			if: `\${{ contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled') }}`,
			run: "exit 1",
		},
	]);
	// A skipped dependency passes, so only fallow-audit may be conditional; the rest must always run.
	for (const name of ["required-checks", "cloudflare-build"]) {
		assert.equal(workflow.jobs[name].if, undefined, name);
		assert.equal(workflow.jobs[name].needs, undefined, name);
	}
	assert.equal(workflow.jobs["fallow-audit"].if, "github.event_name == 'pull_request'");
});
