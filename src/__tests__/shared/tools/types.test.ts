import { describe, expect, test } from "bun:test";
import { z } from "zod";
import type { ToolContext, ToolResult } from "../../../shared/tools/types.js";
import {
	assertProviderToken,
	defineTool,
	normalizeOutputSchema,
	toolFail,
} from "../../../shared/tools/types.js";

// Minimal valid context for tests
const baseContext: ToolContext = {
	sessionId: "test-session",
	getUser: async () => ({ data: null, error: null }),
	getToken: () => ({ data: null, error: null }),
};

// ─────────────────────────────────────────────────────────────────────────────
// normalizeOutputSchema
// ─────────────────────────────────────────────────────────────────────────────

describe("normalizeOutputSchema", () => {
	test("returns shape as-is when given a ZodRawShape", () => {
		const shape = { foo: z.string(), bar: z.number() };
		expect(normalizeOutputSchema(shape)).toBe(shape);
	});

	test("extracts .shape from a ZodObject", () => {
		const schema = z.object({ foo: z.string() });
		expect(normalizeOutputSchema(schema)).toBe(schema.shape);
	});
});

// ─────────────────────────────────────────────────────────────────────────────

// toolFail
// ─────────────────────────────────────────────────────────────────────────────

describe("toolFail", () => {
	test("merges error string into defaults", () => {
		const fail = toolFail({ ok: false, value: null });
		const result = fail("something went wrong");
		expect(result).toEqual({
			ok: false,
			value: null,
			error: "something went wrong",
		});
	});

	test("does not mutate defaults", () => {
		const defaults = { ok: false };
		const fail = toolFail(defaults);
		fail("oops");
		expect(defaults).toEqual({ ok: false });
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// assertProviderToken
// ─────────────────────────────────────────────────────────────────────────────

describe("assertProviderToken", () => {
	test("throws when providerToken is missing", () => {
		expect(() => assertProviderToken(baseContext)).toThrow(
			"Authentication required",
		);
	});

	test("does not throw when providerToken is present", () => {
		const ctx = { ...baseContext, providerToken: "tok_abc" };
		expect(() => assertProviderToken(ctx)).not.toThrow();
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// defineTool
// ─────────────────────────────────────────────────────────────────────────────

describe("defineTool", () => {
	const inputSchema = z.object({ name: z.string() });

	test("returns a tool with correct metadata", () => {
		const tool = defineTool({
			name: "greet",
			description: "Greet someone",
			inputSchema,
			handler: async ({ name }) => ({
				content: [{ type: "text" as const, text: `Hello ${name}` }],
			}),
		});
		expect(tool.name).toBe("greet");
		expect(tool.description).toBe("Greet someone");
		expect(tool.inputSchema).toBe(inputSchema);
	});

	test("normalizes outputSchema from ZodObject to shape", () => {
		const outputSchema = z.object({ greeting: z.string() });
		const tool = defineTool({
			name: "greet",
			description: "Greet",
			inputSchema,
			outputSchema,
			handler: async ({ name }) => ({
				content: [{ type: "text" as const, text: name }],
				structuredContent: { greeting: name },
			}),
		});
		expect(tool.outputSchema).toBe(outputSchema.shape);
	});

	test("wraps plain object handler result", async () => {
		const tool = defineTool({
			name: "greet",
			description: "Greet",
			inputSchema,
			handler: async ({ name }) => ({ greeting: `Hello ${name}` }),
		});
		const result = (await tool.handler(
			{ name: "Alice" },
			baseContext,
		)) as ToolResult;
		expect(result.content[0].type).toBe("text");
		expect(result.structuredContent).toEqual({ greeting: "Hello Alice" });
	});

	test("passes through ToolResult unchanged (no structuredContent)", async () => {
		const tool = defineTool({
			name: "greet",
			description: "Greet",
			inputSchema,
			handler: async ({ name }) => ({
				content: [{ type: "text" as const, text: name }],
			}),
		});
		const result = (await tool.handler(
			{ name: "Bob" },
			baseContext,
		)) as ToolResult;
		expect(result.content[0]).toEqual({ type: "text", text: "Bob" });
		expect(result.structuredContent).toBeUndefined();
	});

	test("injects meta fields into plain object result", async () => {
		const tool = defineTool({
			name: "greet",
			description: "Greet",
			inputSchema,
			meta: { version: "2.0.0" },
			handler: async ({ name }) => ({ greeting: name }),
		});
		const result = (await tool.handler(
			{ name: "Dave" },
			baseContext,
		)) as ToolResult;
		expect(result.structuredContent).toMatchObject({
			greeting: "Dave",
			tool_version: "2.0.0",
		});
	});

	test("requiresAuth is passed through", () => {
		const tool = defineTool({
			name: "secure",
			description: "Secure tool",
			inputSchema,
			requiresAuth: true,
			handler: async () => ({
				content: [{ type: "text" as const, text: "ok" }],
			}),
		});
		expect(tool.requiresAuth).toBe(true);
	});
});
