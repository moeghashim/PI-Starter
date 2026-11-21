import { execFileSync } from "node:child_process";
import { globSync, readFileSync } from "node:fs";

const [base, head = "HEAD"] = process.argv.slice(2);
const limit = 1500;
const excludes = [
	"agent/upstream/**",
	"**/vendor/**",
	"**/package-lock.json",
	"**/npm-shrinkwrap.json",
	"**/pnpm-lock.yaml",
	"**/yarn.lock",
	"**/bun.lock",
	"**/bun.lockb",
	"**/Cargo.lock",
	"**/*.gen.*",
	"**/generated/**",
	"**/cloudflare-env.d.ts",
	"**/next-env.d.ts",
];

function vendoredPathspecs() {
	return globSync("agent/*manifest*.json")
		.flatMap((path) => JSON.parse(readFileSync(path, "utf8")).files ?? [])
		.map(({ localPath }) => `:(exclude,literal)${localPath}`);
}

try {
	if (!base) throw new Error("Usage: npm run pr:size -- <base> [head]");
	const sha = (ref) =>
		execFileSync("git", ["rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`], {
			encoding: "utf8",
		}).trim();
	const diff = execFileSync(
		"git",
		[
			"diff",
			"--numstat",
			"-z",
			"--find-renames",
			`${sha(base)}...${sha(head)}`,
			"--",
			...excludes.map((glob) => `:(exclude,glob)${glob}`),
			...vendoredPathspecs(),
			":(exclude,attr:linguist-generated)",
			":(exclude,attr:linguist-vendored)",
		],
		{ encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
	);
	let lines = 0;
	const records = diff.split("\0");
	for (let index = 0; index < records.length - 1; index += 1) {
		const stat = /^(\d+|-)\t(\d+|-)\t/.exec(records[index]);
		if (!stat) throw new Error("Invalid Git numstat record.");
		lines += (Number(stat[1]) || 0) + (Number(stat[2]) || 0);
		if (records[index].length === stat[0].length) index += 2; // Rename records have two following paths.
	}
	const message = `PR size: ${lines} changed lines (warning threshold ${limit}).`;
	if (lines > limit) console.warn(process.env.GITHUB_ACTIONS === "true" ? `::warning::${message}` : message);
	else console.log(message);
} catch (error) {
	console.error(error.message);
	process.exitCode = 1;
}
