import { describe, expect, test } from "bun:test";
import { healthTool } from "../../../shared/tools/health.js";
import type { ToolContext } from "../../../shared/tools/types.js";

const ctx: ToolContext = {
	sessionId: "test",
	getUser: async () => ({ data: null, error: null }),
	getToken: () => ({ data: null, error: null }),
};

describe("healthTool", () => {
	test("has correct name and metadata", () => {
		expect(healthTool.name).toBe("health");
		expect(healthTool.annotations?.readOnlyHint).toBe(true);
		expect(healthTool.annotations?.destructiveHint).toBe(false);
	});

	test("returns status ok", async () => {
		const result = await healthTool.handler({}, ctx);
		const sc = result.structuredContent as Record<string, unknown>;
		expect(sc.status).toBe("ok");
	});

	test("returns a numeric timestamp", async () => {
		const before = Date.now();
		const result = await healthTool.handler({}, ctx);
		const after = Date.now();
		const sc = result.structuredContent as Record<string, unknown>;
		expect(typeof sc.timestamp).toBe("number");
		expect(sc.timestamp as number).toBeGreaterThanOrEqual(before);
		expect(sc.timestamp as number).toBeLessThanOrEqual(after);
	});

	test("returns runtime string", async () => {
		const result = await healthTool.handler({}, ctx);
		const sc = result.structuredContent as Record<string, unknown>;
		expect(typeof sc.runtime).toBe("string");
	});

	test("verbose=false does not include uptime/nodeVersion", async () => {
		const result = await healthTool.handler({ verbose: false }, ctx);
		const sc = result.structuredContent as Record<string, unknown>;
		expect(sc.uptime).toBeUndefined();
		expect(sc.nodeVersion).toBeUndefined();
	});

	test("verbose=true includes uptime and nodeVersion in Node", async () => {
		const result = await healthTool.handler({ verbose: true }, ctx);
		const sc = result.structuredContent as Record<string, unknown>;
		// In Node.js runtime these should be present
		expect(sc.uptime).toBeDefined();
		expect(sc.nodeVersion).toBeDefined();
	});

	test("content is valid JSON", async () => {
		const result = await healthTool.handler({}, ctx);
		const text = (result.content[0] as { type: "text"; text: string }).text;
		expect(() => JSON.parse(text)).not.toThrow();
	});
});
