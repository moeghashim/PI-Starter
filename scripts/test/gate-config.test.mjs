import assert from "node:assert/strict";
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { parse } from "yaml";
import { sandbox } from "./helpers.mjs";

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

test("validation runs only on GitHub-hosted Ubuntu and verifies pinned upstream skills", () => {
	const validation = workflow.jobs["required-checks"];
	assert.deepEqual(validation.strategy.matrix.os, ["ubuntu-latest"]);
	const upstream = validation.steps.find((step) => step.run === "npm run agent:verify-upstream");
	assert.ok(upstream);
	assert.equal(upstream.if, undefined);
});

test("gate commands run through Node on PATH without nvm and hand npm the documented checks", (t) => {
	const { copy, directory, env, exec, write } = sandbox(t);
	copy("scripts/gate-check.mjs");
	write("bin/npm", '#!/bin/sh\nprintf \'%s\\n\' "$*" >> "$NPM_LOG"\n');
	chmodSync(join(directory, "bin/npm"), 0o755);
	env.NPM_LOG = join(directory, "npm.log");
	env.NVM_DIR = "/nonexistent-pi-starter-nvm";
	env.PATH = `${join(directory, "bin")}:${dirname(process.execPath)}:${env.PATH}`;
	const invocations = (command) => {
		writeFileSync(env.NPM_LOG, "");
		const result = exec("sh", ["-c", command]);
		assert.equal(result.status, 0, result.stderr);
		return readFileSync(env.NPM_LOG, "utf8").trim().split("\n");
	};
	assert.deepEqual(invocations(gate.commands.prepare), ["ci --prefer-offline"]);
	assert.deepEqual(invocations(gate.commands.test), ["test", "run test:e2e --if-present"]);
	assert.deepEqual(invocations(gate.commands.lint), ["run check", "run agent:check", "run fallow:audit"]);
});

test("stable Required checks job requires every dependency to succeed, allowing only a skipped Fallow audit", () => {
	const job = Object.values(workflow.jobs).find(
		(candidate) => candidate.name === "Required checks" && !candidate.strategy,
	);
	assert.ok(job, "branch protection needs a non-matrix Required checks job");
	assert.equal(job.if, `\${{ always() }}`);
	assert.deepEqual(new Set(job.needs), new Set(["required-checks", "cloudflare-build", "fallow-audit"]));
	assert.deepEqual(job.steps, [
		{
			name: "Require successful validation",
			if: `\${{ needs.required-checks.result != 'success' || needs.cloudflare-build.result != 'success' || (needs.fallow-audit.result != 'success' && needs.fallow-audit.result != 'skipped') }}`,
			run: "exit 1",
		},
	]);
});
