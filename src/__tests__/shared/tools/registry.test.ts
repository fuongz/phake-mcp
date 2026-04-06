import { describe, expect, spyOn, test } from "bun:test";
import { z } from "zod";
import {
	defineTool,
	executeSharedTool,
	getSharedTool,
	getSharedToolNames,
	sharedTools,
} from "../../../shared/tools/registry.js";
import type { ToolContext } from "../../../shared/tools/types.js";

const baseContext: ToolContext = { sessionId: "test-session" };

// ─────────────────────────────────────────────────────────────────────────────
// sharedTools / getSharedTool / getSharedToolNames
// ─────────────────────────────────────────────────────────────────────────────

describe("sharedTools", () => {
	test("includes health and echo tools", () => {
		const names = sharedTools.map((t) => t.name);
		expect(names).toContain("health");
		expect(names).toContain("echo");
	});
});

describe("getSharedTool", () => {
	test("returns tool by name", () => {
		expect(getSharedTool("echo")?.name).toBe("echo");
		expect(getSharedTool("health")?.name).toBe("health");
	});

	test("returns undefined for unknown tool", () => {
		expect(getSharedTool("does_not_exist")).toBeUndefined();
	});
});

describe("getSharedToolNames", () => {
	test("returns array of strings", () => {
		const names = getSharedToolNames();
		expect(Array.isArray(names)).toBe(true);
		expect(names.every((n) => typeof n === "string")).toBe(true);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// executeSharedTool
// ─────────────────────────────────────────────────────────────────────────────

describe("executeSharedTool", () => {
	test("returns error for unknown tool", async () => {
		const result = await executeSharedTool("unknown_tool", {}, baseContext);
		expect(result.isError).toBe(true);
		expect(result.content[0]).toMatchObject({
			type: "text",
			text: expect.stringContaining("Unknown tool"),
		});
	});

	test("returns error for invalid input", async () => {
		// echo requires message (string, min 1)
		const result = await executeSharedTool("echo", {}, baseContext);
		expect(result.isError).toBe(true);
		expect(result.content[0]).toMatchObject({
			type: "text",
			text: expect.stringContaining("Invalid input"),
		});
	});

	test("executes echo tool successfully", async () => {
		const result = await executeSharedTool(
			"echo",
			{ message: "hi" },
			baseContext,
		);
		expect(result.isError).toBeFalsy();
		expect(result.content[0]).toMatchObject({ type: "text", text: "hi" });
		expect(result.structuredContent).toMatchObject({ echoed: "hi", length: 2 });
	});

	test("executes health tool successfully", async () => {
		const result = await executeSharedTool("health", {}, baseContext);
		expect(result.isError).toBeFalsy();
		expect(result.structuredContent).toMatchObject({ status: "ok" });
	});

	test("returns cancelled when signal is already aborted", async () => {
		const controller = new AbortController();
		controller.abort();
		const ctx = { ...baseContext, signal: controller.signal };
		const result = await executeSharedTool("echo", { message: "hi" }, ctx);
		expect(result.isError).toBe(true);
		expect(result.content[0]).toMatchObject({
			type: "text",
			text: expect.stringContaining("cancelled"),
		});
	});

	test("uses custom tool list when provided", async () => {
		const customTool = defineTool({
			name: "custom",
			description: "Custom tool",
			inputSchema: z.object({ value: z.number() }),
			handler: async ({ value }) => ({ result: value * 2 }),
		});
		const result = await executeSharedTool(
			"custom",
			{ value: 5 },
			baseContext,
			[customTool as any],
		);
		expect(result.isError).toBeFalsy();
		expect(result.structuredContent).toMatchObject({ result: 10 });
	});

	test("wraps thrown errors as isError result", async () => {
		const spy = spyOn(console, "error").mockImplementation(() => {});
		const throwingTool = defineTool({
			name: "thrower",
			description: "Throws an error",
			inputSchema: z.object({}),
			handler: async () => {
				throw new Error("boom");
			},
		});
		const result = await executeSharedTool("thrower", {}, baseContext, [
			throwingTool as any,
		]);
		spy.mockRestore();
		expect(result.isError).toBe(true);
		expect(result.content[0]).toMatchObject({
			type: "text",
			text: expect.stringContaining("boom"),
		});
	});

	test("returns error when outputSchema defined but structuredContent missing", async () => {
		const badTool = defineTool({
			name: "bad_output",
			description: "Missing structuredContent",
			inputSchema: z.object({}),
			outputSchema: { value: z.string() },
			// Return raw ToolResult without structuredContent to bypass defineTool wrapping
			handler: async () =>
				({ content: [{ type: "text" as const, text: "ok" }] }) as any,
		});
		const result = await executeSharedTool("bad_output", {}, baseContext, [
			badTool as any,
		]);
		expect(result.isError).toBe(true);
		expect(result.content[0]).toMatchObject({
			type: "text",
			text: expect.stringContaining("structuredContent"),
		});
	});
});
