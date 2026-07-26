import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";
import YAML from "yaml";

const root = process.cwd();
const workflow = YAML.parse(readFileSync(".github/workflows/update-model-catalog.yml", "utf8"));
const steps = workflow.jobs.refresh.steps;
const commitStep = steps.find((step) => step.name === "Commit, push, and open refresh PR");
const countScript = join(root, "packages/pi-ai/scripts/model-catalog-counts.mjs");
const generatorScript = join(root, "packages/pi-ai/scripts/generate-models.ts");

function run(command, args, options = {}) {
	const result = spawnSync(command, args, {
		cwd: options.cwd ?? root,
		encoding: "utf8",
		env: { ...process.env, ...options.env },
	});
	if (options.expectSuccess !== false) {
		assert.equal(result.status, 0, `${command} ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
	}
	return result;
}

function git(cwd, ...args) {
	return run("git", args, { cwd }).stdout.trim();
}

test("catalog count snapshots share one executable implementation", (t) => {
	const tempRoot = mkdtempSync(join(root, ".model-catalog-counts-"));
	t.after(() => rmSync(tempRoot, { recursive: true, force: true }));

	const catalogDir = join(tempRoot, "catalog");
	mkdirSync(catalogDir);
	writeFileSync(
		join(catalogDir, "models.generated.ts"),
		[
			"export const MODELS = {",
			'\t"alpha": {',
			'\t\t"alpha-one": {',
			"\t\t},",
			'\t\t"alpha-two": {',
			"\t\t},",
			"\t},",
			"};",
		].join("\n"),
	);

	const typescriptCounts = run(process.execPath, [countScript, catalogDir]);
	assert.equal(typescriptCounts.stdout, "providers=1\nmodels=2\n");

	writeFileSync(
		join(catalogDir, "models.generated.json"),
		JSON.stringify({ alpha: { one: {} }, beta: { two: {}, three: {} } }),
	);
	const jsonCounts = run(process.execPath, [countScript, catalogDir]);
	assert.equal(jsonCounts.stdout, "providers=2\nmodels=3\n");

	const countSteps = steps.filter((step) => step.name.startsWith("Snapshot catalog counts"));
	assert.equal(countSteps.length, 2);
	assert.equal(countSteps[0].run, countSteps[1].run);
	assert.match(countSteps[0].run, /model-catalog-counts\.mjs/);
});

test("generator reports unexpected failures with a nonzero exit", (t) => {
	const tempRoot = mkdtempSync(join(root, ".model-catalog-generator-"));
	t.after(() => rmSync(tempRoot, { recursive: true, force: true }));

	const preloadPath = join(tempRoot, "fail-write.mjs");
	writeFileSync(
		preloadPath,
		[
			'import fs from "node:fs";',
			'import { syncBuiltinESMExports } from "node:module";',
			"globalThis.fetch = async (url) => ({",
			"\tasync json() {",
			'\t\tif (String(url).includes("models.dev")) {',
			"\t\t\treturn {",
			'\t\t\t\tanthropic: { models: { test: { name: "Test", tool_call: true } } },',
			"\t\t\t};",
			"\t\t}",
			"\t\treturn { data: [] };",
			"\t},",
			"});",
			'fs.writeFileSync = () => { throw new Error("forced write failure"); };',
			"syncBuiltinESMExports();",
		].join("\n"),
	);

	const result = run(
		process.execPath,
		["--import", pathToFileURL(preloadPath).href, generatorScript],
		{ expectSuccess: false },
	);

	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /forced write failure/);
});

test("refresh workflow reuses its bot PR when JSON output is absent", (t) => {
	const tempRoot = mkdtempSync(join(root, ".model-catalog-workflow-"));
	t.after(() => rmSync(tempRoot, { recursive: true, force: true }));

	const remote = join(tempRoot, "remote.git");
	const repo = join(tempRoot, "repo");
	const binDir = join(tempRoot, "bin");
	const ghLog = join(tempRoot, "gh.log");
	const ghState = join(tempRoot, "pr-open");
	mkdirSync(repo);
	mkdirSync(binDir);
	git(tempRoot, "init", "--bare", remote);
	git(repo, "init", "-b", "main");
	git(repo, "config", "user.name", "Test User");
	git(repo, "config", "user.email", "test@example.com");

	const catalogDir = join(repo, "packages/pi-ai/src");
	mkdirSync(catalogDir, { recursive: true });
	const typescriptCatalog = join(catalogDir, "models.generated.ts");
	writeFileSync(typescriptCatalog, "version one\n");
	git(repo, "add", typescriptCatalog);
	git(repo, "commit", "-m", "initial catalog");
	git(repo, "remote", "add", "origin", remote);
	git(repo, "push", "-u", "origin", "main");

	const ghPath = join(binDir, "gh");
	writeFileSync(
		ghPath,
		[
			"#!/bin/sh",
			'printf "%s\\n" "$*" >> "$GH_LOG"',
			'if [ "$1 $2" = "pr list" ]; then',
			'\tif [ -f "$GH_STATE" ]; then printf "%s\\n" "https://example.test/pr/1"; fi',
			'elif [ "$1 $2" = "pr create" ]; then',
			'\ttouch "$GH_STATE"',
			'\tprintf "%s\\n" "https://example.test/pr/1"',
			'elif [ "$1 $2" = "pr merge" ]; then',
			"\texit 1",
			"fi",
		].join("\n"),
	);
	chmodSync(ghPath, 0o755);

	const env = {
		AFTER_MODELS: "2",
		AFTER_PROVIDERS: "1",
		BEFORE_MODELS: "1",
		BEFORE_PROVIDERS: "1",
		GITHUB_RUN_NUMBER: "1",
		GH_LOG: ghLog,
		GH_STATE: ghState,
		PATH: `${binDir}:${process.env.PATH}`,
		TMPDIR: tempRoot,
	};

	writeFileSync(typescriptCatalog, "version two\n");
	const firstRun = run("bash", ["-c", commitStep.run], { cwd: repo, env });
	assert.match(firstRun.stdout, /Opened PR: https:\/\/example\.test\/pr\/1/);
	assert.match(firstRun.stdout, /auto-merge unavailable; leaving PR for manual review/);
	assert.equal(git(remote, "show", "bot/model-catalog-refresh:packages/pi-ai/src/models.generated.ts"), "version two");

	git(repo, "checkout", "main");
	writeFileSync(typescriptCatalog, "version three\n");
	const secondRun = run("bash", ["-c", commitStep.run], {
		cwd: repo,
		env: { ...env, GITHUB_RUN_NUMBER: "2" },
	});
	assert.match(secondRun.stdout, /Updated PR: https:\/\/example\.test\/pr\/1/);
	assert.equal(git(remote, "show", "bot/model-catalog-refresh:packages/pi-ai/src/models.generated.ts"), "version three");

	const ghCalls = readFileSync(ghLog, "utf8").split("\n");
	assert.equal(ghCalls.filter((call) => call.startsWith("pr create ")).length, 1);
	assert.equal(ghCalls.filter((call) => call.startsWith("pr edit ")).length, 1);
	assert.equal(ghCalls.filter((call) => call.startsWith("pr list ")).length, 2);
	assert.equal(git(remote, "branch", "--list", "bot/model-catalog-refresh"), "bot/model-catalog-refresh");
	assert.equal(git(remote, "ls-tree", "-r", "--name-only", "bot/model-catalog-refresh").includes("models.generated.json"), false);
});
