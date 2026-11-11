import assert from "node:assert/strict";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { root, sandbox } from "./helpers.mjs";

test("progress append-only check accepts appends and rejects edits to earlier lines", (t) => {
	const s = sandbox(t);
	s.copy("scripts/progress-append-only-check.mjs");
	s.write("progress.md", "# Log\n\n## first\n");
	s.run("git", ["add", "."]);
	s.run("git", ["commit", "-q", "-m", "fixture"]);

	s.write("progress.md", "# Log\n\n## first\n## second\n");
	s.run("git", ["add", "progress.md"]);
	assert.equal(s.node("scripts/progress-append-only-check.mjs").status, 0);

	s.write("progress.md", "# Log\n\n## first (edited)\n## second\n");
	s.run("git", ["add", "progress.md"]);
	const rejected = s.node("scripts/progress-append-only-check.mjs");
	assert.notEqual(rejected.status, 0);
	assert.match(rejected.stderr, /append-only/);
});

test("sync-versions rewrites workspace ranges and refuses mismatched lockstep versions", (t) => {
	const s = sandbox(t);
	s.copy("scripts/sync-versions.js");
	s.write("package.json", JSON.stringify({ workspaces: ["apps/*", "packages/*"] }));
	s.write("packages/core/package.json", JSON.stringify({ name: "@fixture/core", version: "1.2.3" }));
	s.write(
		"apps/web/package.json",
		JSON.stringify({
			name: "@fixture/web",
			version: "1.2.3",
			dependencies: { "@fixture/core": "^0.0.1", other: "1.0.0" },
		}),
	);
	assert.equal(s.node("scripts/sync-versions.js").status, 0);
	const web = JSON.parse(readFileSync(join(s.directory, "apps/web/package.json"), "utf8"));
	assert.deepEqual(web.dependencies, { "@fixture/core": "^1.2.3", other: "1.0.0" });

	s.write("packages/core/package.json", JSON.stringify({ name: "@fixture/core", version: "2.0.0" }));
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
		s.write("docs/doc.md", content);
		s.write("docs/archive/ignored.md", "no front matter, excluded directory\n");
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
	s.write("a.txt", "a\n");
	s.write("b.txt", "b\n");
	s.run("git", ["add", "."]);
	s.run("git", ["commit", "-q", "-m", "fixture"]);

	s.write("a.txt", "a changed\n");
	s.write("b.txt", "b changed\n");
	s.run("git", ["add", "b.txt"]);
	const result = s.exec("bash", [join(root, "scripts/committer"), "chore: only a", "a.txt"]);
	assert.equal(result.status, 0, result.stderr);
	assert.equal(s.run("git", ["show", "--name-only", "--format=", "HEAD"]), "a.txt");
	assert.equal(s.run("git", ["status", "--porcelain"]), "M b.txt");

	const dot = s.exec("bash", [join(root, "scripts/committer"), "chore: everything", "."]);
	assert.notEqual(dot.status, 0);
	assert.match(dot.stderr, /"\." is not allowed/);
});

test("agent-sync verify-local passes offline and detects edited, extra, and missing vendored files", (t) => {
	const s = sandbox(t);
	const manifest = "agent/skills-manifest.mattpocock.json";
	const vendored = ".agents/skills/domain-modeling";
	s.copy("scripts/agent-sync.mjs");
	s.copy(manifest);
	s.copy(".agents/skills");
	const verify = () => s.node("scripts/agent-sync.mjs", "verify-local", "--manifest", manifest);

	const clean = verify();
	assert.equal(clean.status, 0, clean.stderr);

	const skillFile = join(s.directory, vendored, "SKILL.md");
	const original = readFileSync(skillFile);
	writeFileSync(skillFile, `${original}\ninjected instruction\n`);
	assert.match(verify().stderr, /domain-modeling: local content does not match/);
	writeFileSync(skillFile, original);

	s.write(`${vendored}/extra.md`, "unexpected\n");
	assert.match(verify().stderr, /domain-modeling: local content does not match/);
	rmSync(join(s.directory, vendored, "extra.md"));
	assert.equal(verify().status, 0);

	rmSync(join(s.directory, vendored), { recursive: true });
	assert.match(verify().stderr, /domain-modeling: directory missing/);
});
