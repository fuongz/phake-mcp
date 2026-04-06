import { describe, expect, test } from "bun:test";
import {
	knownPackageManagerNames,
	templates,
} from "../../create-mcp/templates.js";

describe("templates", () => {
	test("has at least one template", () => {
		expect(templates.length).toBeGreaterThan(0);
	});

	test("each template has a non-empty value and description", () => {
		for (const t of templates) {
			expect(t.value.length).toBeGreaterThan(0);
			expect(t.description.length).toBeGreaterThan(0);
		}
	});

	test("template values are unique", () => {
		const values = templates.map((t) => t.value);
		expect(new Set(values).size).toBe(values.length);
	});

	test("contains expected templates", () => {
		const values = templates.map((t) => t.value);
		expect(values).toContain("cloudflare-workers");
		expect(values).toContain("cloudflare-workers-google");
		expect(values).toContain("node-hono");
	});
});

describe("knownPackageManagerNames", () => {
	test("includes the four major package managers", () => {
		expect(knownPackageManagerNames).toContain("npm");
		expect(knownPackageManagerNames).toContain("bun");
		expect(knownPackageManagerNames).toContain("yarn");
		expect(knownPackageManagerNames).toContain("pnpm");
	});

	test("has no duplicates", () => {
		expect(new Set(knownPackageManagerNames).size).toBe(
			knownPackageManagerNames.length,
		);
	});
});
