import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

function sandbox(t) {
	const cwd = mkdtempSync(join(tmpdir(), "pi-automation-test-"));
	t.after(() => rmSync(cwd, { recursive: true, force: true }));
	const env = { ...process.env, HUSKY: "0", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" };
	const exec = (command, args) => spawnSync(command, args, { cwd, env, encoding: "utf8" });
	const git = (...args) => {
		const result = exec("git", args);
		assert.equal(result.status, 0, result.stderr);
		return result.stdout.trim();
	};
	const put = (name, content) => {
		mkdirSync(dirname(join(cwd, name)), { recursive: true });
		writeFileSync(join(cwd, name), content);
	};
	const copy = (name) => cpSync(join(repoRoot, name), join(cwd, name), { recursive: true });
	const node = (script, ...args) => exec(process.execPath, [script, ...args]);
	const initGit = () => {
		git("init", "-q", "-b", "main");
		git("config", "user.name", "Automation Test");
		git("config", "user.email", "automation@example.invalid");
		git("config", "commit.gpgsign", "false");
	};
	return { cwd, exec, git, put, copy, node, initGit };
}

test("progress append-only check accepts appends and rejects edits to earlier lines", (t) => {
	const s = sandbox(t);
	s.initGit();
	s.copy("scripts/progress-append-only-check.mjs");
	s.put("progress.md", "# Log\n\n## first\n");
	s.git("add", ".");
	s.git("commit", "-q", "-m", "fixture");

	s.put("progress.md", "# Log\n\n## first\n## second\n");
	s.git("add", "progress.md");
	assert.equal(s.node("scripts/progress-append-only-check.mjs").status, 0);

	s.put("progress.md", "# Log\n\n## first (edited)\n## second\n");
	s.git("add", "progress.md");
	const rejected = s.node("scripts/progress-append-only-check.mjs");
	assert.notEqual(rejected.status, 0);
	assert.match(rejected.stderr, /append-only/);
});

test("sync-versions rewrites workspace ranges and refuses mismatched lockstep versions", (t) => {
	const s = sandbox(t);
	s.copy("scripts/sync-versions.js");
	s.put("package.json", JSON.stringify({ workspaces: ["apps/*", "packages/*"] }));
	s.put("packages/core/package.json", JSON.stringify({ name: "@fixture/core", version: "1.2.3" }));
	s.put(
		"apps/web/package.json",
		JSON.stringify({
			name: "@fixture/web",
			version: "1.2.3",
			dependencies: { "@fixture/core": "^0.0.1", other: "1.0.0" },
		}),
	);
	assert.equal(s.node("scripts/sync-versions.js").status, 0);
	const web = JSON.parse(readFileSync(join(s.cwd, "apps/web/package.json"), "utf8"));
	assert.deepEqual(web.dependencies, { "@fixture/core": "^1.2.3", other: "1.0.0" });

	s.put("packages/core/package.json", JSON.stringify({ name: "@fixture/core", version: "2.0.0" }));
	const mismatch = s.node("scripts/sync-versions.js");
	assert.notEqual(mismatch.status, 0);
	assert.match(mismatch.stderr, /lockstep/);
});

const frontMatterCases = [
	["valid block list", "---\nsummary: Valid doc\nread_when:\n  - Always.\n---\n", null],
	["valid inline list", "---\nsummary: 'Inline doc'\nread_when: ['One', 'Two']\n---\n", null],
	["missing front matter", "# No front matter\n", /missing front matter/],
	["unterminated front matter", "---\nsummary: Open\n", /unterminated front matter/],
	["missing summary", "---\nread_when:\n  - Always.\n---\n", /summary key missing or empty/],
	["missing read_when", "---\nsummary: No hints\n---\n", /read_when key missing/],
	["empty read_when", "---\nsummary: Empty hints\nread_when:\n---\n", /read_when must be a non-empty list/],
];

for (const [label, content, expectedError] of frontMatterCases) {
	test(`docs-list front-matter validation: ${label}`, (t) => {
		const s = sandbox(t);
		s.copy("scripts/docs-list.mjs");
		s.put("docs/doc.md", content);
		s.put("docs/archive/ignored.md", "no front matter, excluded directory\n");
		const result = s.node("scripts/docs-list.mjs");
		if (expectedError === null) {
			assert.equal(result.status, 0, result.stderr);
			assert.match(result.stdout, /^doc\.md - /m);
		} else {
			assert.notEqual(result.status, 0);
			assert.match(result.stderr, expectedError);
		}
		assert.doesNotMatch(result.stdout + result.stderr, /ignored\.md/);
	});
}

test("committer commits only the listed paths and leaves other staged work out", (t) => {
	const s = sandbox(t);
	s.initGit();
	s.put("a.txt", "a\n");
	s.put("b.txt", "b\n");
	s.git("add", ".");
	s.git("commit", "-q", "-m", "fixture");

	s.put("a.txt", "a changed\n");
	s.put("b.txt", "b changed\n");
	s.git("add", "b.txt");
	const result = s.exec("bash", [join(repoRoot, "scripts/committer"), "chore: only a", "a.txt"]);
	assert.equal(result.status, 0, result.stderr);
	assert.equal(s.git("show", "--name-only", "--format=", "HEAD"), "a.txt");
	assert.equal(s.git("status", "--porcelain"), "M b.txt");

	const dot = s.exec("bash", [join(repoRoot, "scripts/committer"), "chore: everything", "."]);
	assert.notEqual(dot.status, 0);
	assert.match(dot.stderr, /"\." is not allowed/);
});

test("agent-sync verify-local passes offline and detects edited, extra, and missing vendored files", (t) => {
	const s = sandbox(t);
	const manifest = "agent/skills-manifest.mattpocock.json";
	const vendored = "agent/skills/mattpocock/domain-model";
	s.copy("scripts/agent-sync.mjs");
	s.copy(manifest);
	s.copy("agent/skills/mattpocock");
	const verify = () => s.node("scripts/agent-sync.mjs", "verify-local", "--manifest", manifest);

	assert.equal(verify().status, 0, verify().stderr);

	const skillFile = join(s.cwd, vendored, "SKILL.md");
	const original = readFileSync(skillFile);
	writeFileSync(skillFile, `${original}\ninjected instruction\n`);
	assert.match(verify().stderr, /domain-model: local content does not match/);
	writeFileSync(skillFile, original);

	s.put(`${vendored}/extra.md`, "unexpected\n");
	assert.match(verify().stderr, /domain-model: local content does not match/);
	rmSync(join(s.cwd, vendored, "extra.md"));
	assert.equal(verify().status, 0);

	rmSync(join(s.cwd, vendored), { recursive: true });
	assert.match(verify().stderr, /domain-model: directory missing/);
});
