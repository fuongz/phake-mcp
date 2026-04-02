#!/usr/bin/env bun

/**
 * Semantic versioning bump script (SemVer 2.0.0)
 * Usage:
 *   bun scripts/version.ts major   # 1.0.0 → 2.0.0
 *   bun scripts/version.ts minor   # 1.0.0 → 1.1.0
 *   bun scripts/version.ts patch   # 1.0.0 → 1.0.1
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type ReleaseType = "major" | "minor" | "patch";

const VALID_TYPES: ReleaseType[] = ["major", "minor", "patch"];

function bump(version: string, type: ReleaseType): string {
	const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
	if (!match) throw new Error(`Invalid version format: ${version}`);

	let [, major, minor, patch] = match.map(Number);

	switch (type) {
		case "major":
			major += 1;
			minor = 0;
			patch = 0;
			break;
		case "minor":
			minor += 1;
			patch = 0;
			break;
		case "patch":
			patch += 1;
			break;
	}

	return `${major}.${minor}.${patch}`;
}

const releaseType = process.argv[2] as ReleaseType;

if (!VALID_TYPES.includes(releaseType)) {
	console.error(`Usage: bun scripts/version.ts <major|minor|patch>`);
	process.exit(1);
}

const pkgPath = resolve(import.meta.dir, "../package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
const currentVersion: string = pkg.version;
const nextVersion = bump(currentVersion, releaseType);

pkg.version = nextVersion;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, "\t")}\n`);

console.log(`${currentVersion} → ${nextVersion}`);
