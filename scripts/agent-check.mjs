#!/usr/bin/env node

import { execSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readlinkSync } from "node:fs";

const REQUIRED_PATHS = [
	"agent/manifest.json",
	"agent/skills-manifest.json",
	"agent/skills-manifest.addyosmani.json",
	"agent/skills-manifest.mattpocock.json",
	"agent/skills-manifest.chromedevtools.json",
	".fallowrc.json",
	".mcp.json",
	".no-mistakes.yaml",
	"docs/README.md",
	"docs/agent-workflow.md",
	"docs/agent-skills.md",
	"docs/architecture-decisions.md",
	"docs/commands.md",
	"docs/deploying-to-vercel.md",
	"progress.md",
	".codex/prompts/pickup.md",
	".codex/prompts/handoff.md",
	".codex/prompts/build-feature.md",
	".codex/prompts/fix.md",
	".codex/prompts/ship.md",
];

const REQUIRED_AGENTS_SNIPPETS = [
	"## Agent Workflow",
	"docs/agent-workflow.md",
	"docs/agent-skills.md",
	"docs/commands.md",
	"npm run docs:list",
	"npm run agent:check",
	"npm run fallow:audit",
	"npm run skills:verify-sync",
	"npm run skills:addy:verify-sync",
	"npm run skills:matt:verify-sync",
	"npm run skills:chrome:verify-sync",
	"git push no-mistakes",
	"useMountEffect",
	"CLAUDE.md",
];

function fail(message) {
	console.error(`agent-check: ${message}`);
	process.exit(1);
}

for (const targetPath of REQUIRED_PATHS) {
	if (!existsSync(targetPath)) {
		fail(`missing required file: ${targetPath}`);
	}
}

if (!existsSync("AGENTS.md")) {
	fail("AGENTS.md is missing");
}

if (!existsSync("CLAUDE.md")) {
	fail("CLAUDE.md compatibility symlink is missing");
}

if (!lstatSync("CLAUDE.md").isSymbolicLink()) {
	fail("CLAUDE.md must be a symlink to AGENTS.md");
}

const claudeTarget = readlinkSync("CLAUDE.md");
if (claudeTarget !== "AGENTS.md") {
	fail(`CLAUDE.md must point to AGENTS.md, found: ${claudeTarget}`);
}

const agents = readFileSync("AGENTS.md", "utf8");
for (const snippet of REQUIRED_AGENTS_SNIPPETS) {
	if (!agents.includes(snippet)) {
		fail(`AGENTS.md missing required snippet: ${snippet}`);
	}
}

if (!existsSync("package.json")) {
	fail("package.json is missing");
}

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const requiredScripts = [
	"docs:list",
	"agent:verify-sync",
	"agent:sync",
	"skills:verify-sync",
	"skills:sync",
	"skills:addy:verify-sync",
	"skills:addy:sync",
	"skills:matt:verify-sync",
	"skills:matt:sync",
	"skills:chrome:verify-sync",
	"skills:chrome:sync",
	"agent:check",
	"fallow:audit",
	"commit:selective",
	"commit:with-progress",
];
for (const scriptName of requiredScripts) {
	if (!packageJson.scripts || !packageJson.scripts[scriptName]) {
		fail(`package.json missing required script: ${scriptName}`);
	}
}

execSync("npm run docs:list", { stdio: "inherit" });
execSync("npm run agent:verify-sync", { stdio: "inherit" });
execSync("npm run skills:verify-sync", { stdio: "inherit" });
execSync("npm run skills:addy:verify-sync", { stdio: "inherit" });
execSync("npm run skills:matt:verify-sync", { stdio: "inherit" });
execSync("npm run skills:chrome:verify-sync", { stdio: "inherit" });

console.log("agent-check: passed.");
