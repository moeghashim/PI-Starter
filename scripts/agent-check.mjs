#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readdirSync, readFileSync, readlinkSync } from "node:fs";

const MANIFEST_PATHS = [
	"agent/manifest.json",
	"agent/skills-manifest.json",
	"agent/skills-manifest.addyosmani.json",
	"agent/skills-manifest.mattpocock.json",
	"agent/skills-manifest.chromedevtools.json",
];

const REQUIRED_PATHS = [
	"AGENTS.md",
	"package.json",
	...MANIFEST_PATHS,
	".fallowrc.json",
	".mcp.json",
	".no-mistakes.yaml",
	"docs/README.md",
	"docs/agent-workflow.md",
	"docs/agent-skills.md",
	"docs/architecture-decisions.md",
	"docs/commands.md",
	"docs/deploying-to-vercel.md",
	"docs/deploying-to-cloudflare.md",
	"progress.md",
	".agents/skills/pickup/SKILL.md",
	".agents/skills/handoff/SKILL.md",
	".agents/skills/build-feature/SKILL.md",
	".agents/skills/fix/SKILL.md",
	".agents/skills/ship/SKILL.md",
];

const SKILLS_DIR = ".agents/skills";
const REQUIRED_SYMLINKS = { "CLAUDE.md": "AGENTS.md", ".claude/skills": "../.agents/skills" };

const REQUIRED_AGENTS_SNIPPETS = [
	"## Agent Workflow",
	"docs/agent-workflow.md",
	"docs/agent-skills.md",
	"docs/commands.md",
	"npm run docs:list",
	"npm run agent:check",
	"npm run agent:verify-upstream",
	"npm run fallow:audit",
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

const agents = readFileSync("AGENTS.md", "utf8");
for (const snippet of REQUIRED_AGENTS_SNIPPETS) {
	if (!agents.includes(snippet)) {
		fail(`AGENTS.md missing required snippet: ${snippet}`);
	}
}

for (const [linkPath, expectedTarget] of Object.entries(REQUIRED_SYMLINKS)) {
	if (!lstatSync(linkPath, { throwIfNoEntry: false })?.isSymbolicLink()) {
		fail(`${linkPath} must be a symlink to ${expectedTarget}`);
	}
	const target = readlinkSync(linkPath);
	if (target !== expectedTarget) {
		fail(`${linkPath} must point to ${expectedTarget}, found: ${target}`);
	}
}

for (const entry of readdirSync(SKILLS_DIR, { withFileTypes: true })) {
	if (entry.name.startsWith(".")) {
		continue;
	}
	const skillFile = `${SKILLS_DIR}/${entry.name}/SKILL.md`;
	if (!entry.isDirectory() || !existsSync(skillFile)) {
		fail(`${SKILLS_DIR}/${entry.name} must be a directory containing SKILL.md`);
	}
	const frontMatter = readFileSync(skillFile, "utf8").match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? "";
	for (const field of ["name", "description"]) {
		if (!new RegExp(`^${field}:\\s*\\S`, "m").test(frontMatter)) {
			fail(`${skillFile} front matter is missing ${field}`);
		}
	}
}

// Every root `npm run <script>` that AGENTS.md tells agents to use must exist. Workspace (-w) commands and
// placeholders such as `release:<bump>` are skipped.
const { scripts = {} } = JSON.parse(readFileSync("package.json", "utf8"));
for (const [, scriptName, workspace] of agents.matchAll(/npm run ([a-z][\w:-]*)( -w)?(?=[\s`"])/g)) {
	if (!workspace && !scripts[scriptName]) {
		fail(`AGENTS.md references missing script: npm run ${scriptName}`);
	}
}

execFileSync(process.execPath, ["scripts/docs-list.mjs"], { stdio: "inherit" });

// Offline integrity for every manifest. Upstream provenance runs separately through `npm run agent:verify-upstream`.
execFileSync(process.execPath, ["scripts/agent-sync.mjs", "verify-local"], { stdio: "inherit" });

console.log("agent-check: passed.");
