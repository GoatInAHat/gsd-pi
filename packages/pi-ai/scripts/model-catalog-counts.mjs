#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const catalogDir = process.argv[2];
if (!catalogDir) {
	throw new Error("catalog directory is required");
}

const jsonPath = join(catalogDir, "models.generated.json");
let providers;
let models;

if (existsSync(jsonPath)) {
	const catalog = JSON.parse(readFileSync(jsonPath, "utf8"));
	providers = Object.keys(catalog).length;
	models = Object.values(catalog).reduce((count, provider) => count + Object.keys(provider).length, 0);
} else {
	const lines = readFileSync(join(catalogDir, "models.generated.ts"), "utf8").split("\n");
	providers = lines.filter((line) => /^\t"[^"]+": \{$/.test(line)).length;
	models = lines.filter((line) => /^\t\t"[^"]+": \{$/.test(line)).length;
}

console.log(`providers=${providers}`);
console.log(`models=${models}`);
