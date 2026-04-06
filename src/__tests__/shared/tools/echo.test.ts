import { describe, expect, test } from "bun:test";
import { echoTool } from "../../../shared/tools/echo.js";
import type { ToolContext } from "../../../shared/tools/types.js";

const ctx: ToolContext = { sessionId: "test" };

describe("echoTool", () => {
	test("has correct name and metadata", () => {
		expect(echoTool.name).toBe("echo");
		expect(echoTool.annotations?.readOnlyHint).toBe(true);
		expect(echoTool.annotations?.destructiveHint).toBe(false);
	});

	test("echoes the message as-is", async () => {
		const result = await echoTool.handler({ message: "hello" }, ctx);
		expect(result.content[0]).toEqual({ type: "text", text: "hello" });
		expect(result.structuredContent).toEqual({ echoed: "hello", length: 5 });
	});

	test("converts to uppercase when flag is true", async () => {
		const result = await echoTool.handler(
			{ message: "hello", uppercase: true },
			ctx,
		);
		expect(result.content[0]).toEqual({ type: "text", text: "HELLO" });
		expect(result.structuredContent).toEqual({ echoed: "HELLO", length: 5 });
	});

	test("leaves message lowercase when uppercase is false", async () => {
		const result = await echoTool.handler(
			{ message: "World", uppercase: false },
			ctx,
		);
		expect((result.content[0] as { type: "text"; text: string }).text).toBe(
			"World",
		);
	});

	test("structuredContent length matches echoed message", async () => {
		const result = await echoTool.handler(
			{ message: "abc", uppercase: true },
			ctx,
		);
		const sc = result.structuredContent as { echoed: string; length: number };
		expect(sc.length).toBe(sc.echoed.length);
	});
});
