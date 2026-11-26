import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { root } from "./helpers.mjs";

const fixture = `
import json
import runpy
from types import SimpleNamespace

watcher = runpy.run_path(".agents/skills/babysit-pr/scripts/pr-wait")
instance = watcher["Watcher"]("example/project", 1, "ready", 20)

def page(threads):
    return {"data": {"viewer": {"login": "reviewer"}, "repository": {"pullRequest": {
        "reviewThreads": {"nodes": threads}
    }}}}

def gh(args):
    assert "--paginate" in args and "--slurp" in args
    query = next(arg for arg in args if arg.startswith("query="))
    assert "after: $endCursor" in query and "pageInfo" in query
    pages = [page([{"isResolved": True}] * 100), page([{"isResolved": False}])]
    return SimpleNamespace(stdout=json.dumps(pages))

instance.fetch_pr.__func__.__globals__["gh"] = gh
threads = instance.fetch_pr()["reviewThreads"]["nodes"]
assert len(threads) == 101
assert not threads[-1]["isResolved"]

instance.fetch_pr.__func__.__globals__["gh"] = lambda args: SimpleNamespace(
    stdout=json.dumps([page([]), {"errors": [{"message": "second page failed"}]}])
)
try:
    instance.fetch_pr()
except watcher["GhError"]:
    pass
else:
    raise AssertionError("Failed review-thread pages must block readiness")
`;

test("the TStack watcher includes unresolved threads after the first page", (t) => {
	const python = ["python3", "/usr/bin/python3"].find((command) => spawnSync(command, ["--version"]).status === 0);
	if (!python) return t.skip("Python 3 is optional for the TStack watcher");
	const result = spawnSync(python, ["-c", fixture], { cwd: root, encoding: "utf8" });
	assert.equal(result.status, 0, result.stderr);
});
