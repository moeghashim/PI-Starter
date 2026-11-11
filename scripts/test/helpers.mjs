import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("../../", import.meta.url));

export function tempDir(t, prefix = "pi-test-") {
	const directory = mkdtempSync(join(tmpdir(), prefix));
	t.after(() => rmSync(directory, { recursive: true, force: true }));
	return directory;
}

// A throwaway git repository whose commands ignore the caller's git config, hooks, and npm environment.
export function sandbox(t) {
	const directory = tempDir(t);
	const env = { ...process.env, HUSKY: "0", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" };
	for (const key of Object.keys(env)) {
		if (key.toLowerCase().startsWith("npm_") || key === "INIT_CWD") delete env[key];
	}
	const exec = (command, args) => spawnSync(command, args, { cwd: directory, env, encoding: "utf8" });
	const run = (command, args) => execFileSync(command, args, { cwd: directory, env, encoding: "utf8" }).trim();
	const write = (name, content) => {
		mkdirSync(dirname(join(directory, name)), { recursive: true });
		writeFileSync(join(directory, name), content);
	};
	const copy = (name) => cpSync(join(root, name), join(directory, name), { recursive: true });
	const node = (script, ...args) => exec(process.execPath, [script, ...args]);
	run("git", ["init", "-q", "-b", "main"]);
	run("git", ["config", "user.name", "Test User"]);
	run("git", ["config", "user.email", "test@example.invalid"]);
	run("git", ["config", "commit.gpgsign", "false"]);
	return { directory, env, exec, run, write, copy, node };
}
