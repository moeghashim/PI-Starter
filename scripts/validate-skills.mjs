#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cwd } from "node:process";

const SKILL_ROOT = "agent/skills";

function fail(message) {
	console.error(`validate-skills: ${message}`);
	process.exit(1);
}

function listSkillFiles(rootPath) {
	const files = [];

	function walk(directory) {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const fullPath = join(directory, entry.name);
			if (entry.isDirectory()) {
				walk(fullPath);
				continue;
			}
			if (entry.isFile() && entry.name === "SKILL.md") {
				files.push(fullPath);
			}
		}
	}

	walk(rootPath);
	return files.sort((a, b) => a.localeCompare(b));
}

function parseFrontMatter(path, content) {
	if (!content.startsWith("---\n")) {
		return { error: "front matter must start on the first line" };
	}

	const endIndex = content.indexOf("\n---", 4);
	if (endIndex === -1) {
		return { error: "front matter must close with ---" };
	}

	const yaml = content.slice(4, endIndex).split("\n");
	const fields = new Map();

	for (let index = 0; index < yaml.length; index += 1) {
		const line = yaml[index];
		const match = line.match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
		if (!match) {
			continue;
		}

		const [, key, rawValue = ""] = match;
		let value = rawValue.trim().replace(/^["']|["']$/g, "");

		if (value.length === 0) {
			const continuation = [];
			for (let next = index + 1; next < yaml.length; next += 1) {
				const nextLine = yaml[next];
				if (/^[A-Za-z0-9_-]+:/.test(nextLine)) {
					break;
				}
				if (/^\s+\S/.test(nextLine)) {
					continuation.push(nextLine.trim());
				}
			}
			value = continuation.join(" ").trim();
		}

		fields.set(key, value);
	}

	return { fields, path };
}

if (!existsSync(SKILL_ROOT)) {
	fail(`missing skill root: ${SKILL_ROOT}`);
}

const skillFiles = await listSkillFiles(join(cwd(), SKILL_ROOT));
if (skillFiles.length === 0) {
	fail(`no SKILL.md files found under ${SKILL_ROOT}`);
}

const names = new Map();
const errors = [];

for (const path of skillFiles) {
	const content = readFileSync(path, "utf8");
	const result = parseFrontMatter(path, content);
	const relativePath = path.slice(cwd().length + 1);

	if (result.error) {
		errors.push(`${relativePath}: ${result.error}`);
		continue;
	}

	for (const field of ["name", "description"]) {
		const value = result.fields.get(field);
		if (!value || value.trim().length === 0) {
			errors.push(`${relativePath}: missing non-empty ${field}`);
		}
	}

	const name = result.fields.get("name");
	if (!name) {
		continue;
	}

	if (names.has(name)) {
		errors.push(`${relativePath}: duplicate skill name "${name}" also used by ${names.get(name)}`);
		continue;
	}
	names.set(name, relativePath);
}

if (errors.length > 0) {
	console.error("validate-skills: failed");
	for (const error of errors) {
		console.error(`- ${error}`);
	}
	process.exit(1);
}

console.log(`validate-skills: validated ${skillFiles.length} skill(s).`);
