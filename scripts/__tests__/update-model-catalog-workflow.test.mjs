import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

function createGeneratorPreload(tempRoot) {
	const preloadPath = join(tempRoot, "mock-generator-io.mjs");
	writeFileSync(
		preloadPath,
		[
			'import fs from "node:fs";',
			'import { syncBuiltinESMExports } from "node:module";',
			"const originalWriteFileSync = fs.writeFileSync.bind(fs);",
			"globalThis.fetch = async (url) => {",
			"\tconst target = String(url);",
			'\tif (process.env.FAIL_SOURCE === "openrouter" && target.includes("openrouter.ai")) {',
			'\t\tthrow new Error("OpenRouter unavailable");',
			"\t}",
			'\tif (process.env.FAIL_SOURCE === "vercel" && target.includes("ai-gateway.vercel.sh")) {',
			'\t\tthrow new Error("Vercel AI Gateway unavailable");',
			"\t}",
			"\treturn {",
			"\t\tasync json() {",
			'\t\t\tif (target.includes("models.dev")) {',
			'\t\t\t\treturn { anthropic: { models: { test: { name: "Test", tool_call: true } } } };',
			"\t\t\t}",
			'\t\t\tif (target.includes("openrouter.ai")) {',
			'\t\t\t\treturn { data: [{ id: process.env.MODEL_ID || "test/model", name: process.env.MODEL_NAME || "Test", supported_parameters: ["tools"] }] };',
			"\t\t\t}",
			'\t\t\treturn { data: [{ id: "test-model", name: "Test", tags: ["tool-use"] }] };',
			"\t\t},",
			"\t};",
			"};",
			"fs.writeFileSync = (_path, data) => {",
			'\tif (process.env.FAIL_WRITE === "1") throw new Error("forced write failure");',
			"\tif (process.env.WRITE_LOG) originalWriteFileSync(process.env.WRITE_LOG, data);",
			"};",
			"syncBuiltinESMExports();",
		].join("\n"),
	);
	return pathToFileURL(preloadPath).href;
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

	const result = run(
		process.execPath,
		["--import", createGeneratorPreload(tempRoot), generatorScript],
		{ env: { FAIL_WRITE: "1" }, expectSuccess: false },
	);

	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /forced write failure/);
});

test("generator refuses partial upstream catalogs", async (t) => {
	const tempRoot = mkdtempSync(join(root, ".model-catalog-upstreams-"));
	t.after(() => rmSync(tempRoot, { recursive: true, force: true }));
	const preload = createGeneratorPreload(tempRoot);

	for (const source of ["openrouter", "vercel"]) {
		await t.test(`${source} failure`, () => {
			const writeLog = join(tempRoot, `${source}-write.log`);
			const result = run(
				process.execPath,
				["--import", preload, generatorScript],
				{
					env: { FAIL_SOURCE: source, WRITE_LOG: writeLog },
					expectSuccess: false,
				},
			);

			assert.notEqual(result.status, 0, `${source} failure must stop generation`);
			assert.equal(existsSync(writeLog), false, `${source} failure must not write the catalog`);
		});
	}
});

test("generator safely serializes upstream model strings", async (t) => {
	const tempRoot = mkdtempSync(join(root, ".model-catalog-serialization-"));
	t.after(() => rmSync(tempRoot, { recursive: true, force: true }));
	const preload = createGeneratorPreload(tempRoot);
	const maliciousId = 'model"with\\escape\nline';
	const maliciousName = 'Model", injected: (globalThis.catalogInjected = true), ignored: "';

	for (const field of ["id", "name"]) {
		await t.test(`${field} string`, () => {
			const modelId = field === "id" ? maliciousId : "test/model";
			const modelName = field === "name" ? maliciousName : "Test";
			const generatedPath = join(tempRoot, `${field}.generated.ts`);
			run(
				process.execPath,
				["--import", preload, generatorScript],
				{ env: { MODEL_ID: modelId, MODEL_NAME: modelName, WRITE_LOG: generatedPath } },
			);

			const inspect = run(
				process.execPath,
				[
					"--experimental-strip-types",
					"--input-type=module",
					"-e",
					[
						"globalThis.catalogInjected = false;",
						`const { MODELS } = await import(${JSON.stringify(pathToFileURL(generatedPath).href)});`,
						"const model = MODELS.openrouter[process.env.MODEL_ID];",
						"process.stdout.write(JSON.stringify({ injected: globalThis.catalogInjected, model }));",
					].join("\n"),
				],
				{ env: { MODEL_ID: modelId } },
			);
			const result = JSON.parse(inspect.stdout);

			assert.equal(result.injected, false);
			assert.equal(result.model.id, modelId);
			assert.equal(result.model.name, modelName);
			assert.equal(result.model.api, "openai-completions");
			assert.equal(result.model.provider, "openrouter");
			assert.equal(result.model.baseUrl, "https://openrouter.ai/api/v1");
		});
	}
});

test("refresh workflow ignores fork PRs and manages its own bot PR without JSON output", (t) => {
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
			'\tif [ -f "$GH_STATE" ]; then',
			'\t\tcase "$*" in',
			'\t\t\t*isCrossRepository*headRepositoryOwner*GITHUB_REPOSITORY_OWNER*) printf "%s\\n" "https://example.test/pr/1" ;;',
			'\t\t\t*) printf "%s\\n" "https://example.test/fork/1" ;;',
			"\t\tesac",
			"\tfi",
			'elif [ "$1 $2" = "pr create" ]; then',
			'\ttouch "$GH_STATE"',
			'\tprintf "%s\\n" "https://example.test/pr/1"',
			'elif [ "$1 $2" = "pr close" ]; then',
			'\trm -f "$GH_STATE"',
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
		GITHUB_REPOSITORY_OWNER: "open-gsd",
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

	git(repo, "checkout", "main");
	const cleanRun = run("bash", ["-c", commitStep.run], {
		cwd: repo,
		env: { ...env, GITHUB_RUN_NUMBER: "3" },
	});
	assert.match(cleanRun.stdout, /Closed stale refresh PR: https:\/\/example\.test\/pr\/1/);
	assert.equal(existsSync(ghState), false);

	const ghCalls = readFileSync(ghLog, "utf8").split("\n");
	assert.equal(ghCalls.filter((call) => call.startsWith("pr create ")).length, 1);
	assert.equal(ghCalls.filter((call) => call.startsWith("pr close ")).length, 1);
	assert.equal(ghCalls.filter((call) => call.startsWith("pr edit ")).length, 1);
	assert.equal(ghCalls.filter((call) => call.startsWith("pr list ")).length, 3);
	assert.equal(ghCalls.filter((call) => call.startsWith("pr merge ")).length, 2);
	assert.equal(ghCalls.some((call) => call.includes("https://example.test/fork/1")), false);
	assert.equal(git(remote, "branch", "--list", "bot/model-catalog-refresh"), "bot/model-catalog-refresh");
	assert.equal(git(remote, "ls-tree", "-r", "--name-only", "bot/model-catalog-refresh").includes("models.generated.json"), false);
});
