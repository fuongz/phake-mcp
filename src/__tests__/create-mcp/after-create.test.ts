import { describe, expect, spyOn, test } from "bun:test";
import { afterCreateHook } from "../../create-mcp/hooks/after-create.js";

describe("afterCreateHook.applyHook", () => {
	test("logs the project name", () => {
		const spy = spyOn(console, "log").mockImplementation(() => {});

		afterCreateHook.applyHook("node-hono", {
			projectName: "my-app",
			directoryPath: "/tmp/my-app",
			packageManager: "npm",
		});

		expect(spy).toHaveBeenCalledWith("Project created: my-app");
		spy.mockRestore();
	});

	test("runs without throwing for any template name", () => {
		const spy = spyOn(console, "log").mockImplementation(() => {});

		expect(() =>
			afterCreateHook.applyHook("cloudflare-workers", {
				projectName: "test-proj",
				directoryPath: "/tmp/test-proj",
				packageManager: "bun",
			}),
		).not.toThrow();

		spy.mockRestore();
	});

	test("accepts all known package managers without throwing", () => {
		const spy = spyOn(console, "log").mockImplementation(() => {});

		for (const pm of ["npm", "bun", "yarn", "pnpm"]) {
			expect(() =>
				afterCreateHook.applyHook("node-hono", {
					projectName: "proj",
					directoryPath: "/tmp/proj",
					packageManager: pm,
				}),
			).not.toThrow();
		}

		spy.mockRestore();
	});
});
