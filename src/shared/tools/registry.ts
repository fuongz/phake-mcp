/**
 * Shared tool registry - single source of truth for all tools.
 * Tools defined here work in both Node.js and Cloudflare Workers.
 */

import type {
	CallToolResult,
	McpServer,
	ServerContext,
	StandardSchemaWithJSON,
} from "@modelcontextprotocol/server";
import type { ZodObject, ZodRawShape } from "zod";
import { z } from "zod";
import { getCurrentAuthContext } from "../../runtime/node/context.js";
import { toProviderInfo } from "../types/provider.js";
import { logger } from "../utils/logger.js";
import { echoTool } from "./echo.js";
import { healthTool } from "./health.js";
import type { SharedToolDefinition, ToolContext, ToolResult } from "./types.js";

/**
 * Optional context resolver for Node.js runtime.
 * Allows looking up auth context by requestId.
 */
export type ContextResolver = (requestId: string | number) =>
	| {
			authStrategy?: ToolContext["authStrategy"];
			providerToken?: string;
			provider?: ToolContext["provider"];
			resolvedHeaders?: Record<string, string>;
	  }
	| undefined;

// Re-export types for convenience
export type { SharedToolDefinition, ToolContext, ToolResult } from "./types.js";
export { defineTool } from "./types.js";

/**
 * Simplified tool interface for the registry (type-erased for storage).
 * This is the "any tool" type used when storing heterogeneous tools in an array.
 */
export interface RegisteredTool {
	name: string;
	title?: string;
	description: string;
	inputSchema: ZodObject<ZodRawShape>;
	outputSchema?: ZodRawShape;
	requiresAuth?: boolean;
	annotations?: Record<string, unknown>;
	handler: (
		args: Record<string, unknown>,
		context: ToolContext,
	) => Promise<ToolResult>;
}

/**
 * Convert a typed SharedToolDefinition to RegisteredTool.
 *
 * This cast is safe because:
 * 1. SharedToolDefinition<T> is structurally compatible with RegisteredTool
 * 2. The Zod schema validates input before the handler receives it
 * 3. At runtime, z.infer<ZodObject<T>> is just a plain object
 *
 * TypeScript can't verify this automatically due to generic type erasure.
 */
function asRegisteredTool<T extends ZodRawShape>(
	tool: SharedToolDefinition<T>,
): RegisteredTool {
	// The handler signature difference (typed args vs Record<string, unknown>)
	// is safe because Zod validation happens before the handler is called
	return tool as unknown as RegisteredTool;
}

/**
 * All shared tools available in both runtimes.
 * Add new tools here to make them available everywhere.
 */
export const sharedTools: RegisteredTool[] = [
	asRegisteredTool(healthTool),
	asRegisteredTool(echoTool),
];

/**
 * Get a tool by name.
 */
export function getSharedTool(name: string): RegisteredTool | undefined {
	return sharedTools.find((t) => t.name === name);
}

/**
 * Get all tool names.
 */
export function getSharedToolNames(): string[] {
	return sharedTools.map((t) => t.name);
}

/**
 * Execute a shared tool by name.
 * Handles input validation, output validation, and error wrapping.
 *
 * Per MCP spec: When outputSchema is defined, structuredContent is required
 * (unless isError is true). The SDK validates this automatically for Node,
 * and we replicate that behavior here for Workers.
 */
export async function executeSharedTool(
	name: string,
	args: Record<string, unknown>,
	context: ToolContext,
	tools?: SharedToolDefinition[],
): Promise<ToolResult> {
	const toolList = tools ?? sharedTools;
	const tool = toolList.find((t) => t.name === name);
	if (!tool) {
		return {
			content: [{ type: "text", text: `Unknown tool: ${name}` }],
			isError: true,
		};
	}

	try {
		// Check for cancellation before starting
		if (context.signal?.aborted) {
			return {
				content: [{ type: "text", text: "Operation was cancelled" }],
				isError: true,
			};
		}

		// Validate input using Zod schema
		const parseResult = tool.inputSchema.safeParse(args);
		if (!parseResult.success) {
			const errors = parseResult.error.issues
				.map((e) => `${e.path.join(".")}: ${e.message}`)
				.join(", ");
			return {
				content: [{ type: "text", text: `Invalid input: ${errors}` }],
				isError: true,
			};
		}

		const result = await tool.handler(
			parseResult.data as Record<string, unknown>,
			context,
		);

		// Validate outputSchema compliance (per MCP spec)
		// When outputSchema is defined, structuredContent is required unless isError is true
		if (tool.outputSchema && !result.isError) {
			if (!result.structuredContent) {
				return {
					content: [
						{
							type: "text",
							text: "Tool with outputSchema must return structuredContent (unless isError is true)",
						},
					],
					isError: true,
				};
			}
			// Note: Full Zod validation of structuredContent against outputSchema
			// could be added here if needed for stricter compliance
		}

		return result;
	} catch (error) {
		// Check if this was an abort
		if (context.signal?.aborted) {
			return {
				content: [{ type: "text", text: "Operation was cancelled" }],
				isError: true,
			};
		}

		const err = error instanceof Error ? error : new Error(String(error));
		logger.error("execute_tool", {
			message: `Tool execution failed: ${err.message}`,
			tool: name,
			stack: err.stack,
		});

		const message = `${err.name}: ${err.message}${err.stack ? `\n${err.stack}` : ""}`;
		return {
			content: [{ type: "text", text: `Tool error: ${message}` }],
			isError: true,
		};
	}
}

/**
 * Register all tools with an MCP server.
 * This is the main entry point for Node.js runtime.
 *
 * @param server - MCP server instance
 * @param contextResolver - Optional function to resolve auth context by requestId.
 *                          Required for tools to receive auth data in Node.js.
 */
export function registerTools(
	server: McpServer,
	contextResolver?: ContextResolver,
): void {
	for (const tool of sharedTools) {
		server.registerTool(
			tool.name,
			{
				description: tool.description,
				inputSchema: tool.inputSchema as unknown as StandardSchemaWithJSON,
				...(tool.outputSchema && {
					outputSchema: z.object(
						tool.outputSchema,
					) as unknown as StandardSchemaWithJSON,
				}),
				...(tool.annotations && { annotations: tool.annotations }),
			},
			async (args: unknown, ctx: ServerContext) => {
				// Look up auth context from registry if resolver provided
				const requestId = ctx.mcpReq.id;
				const authContext =
					requestId && contextResolver ? contextResolver(requestId) : undefined;

				// Fallback to AsyncLocalStorage if requestId not available
				const resolved = authContext ?? getCurrentAuthContext();

				const providerInfo = resolved?.provider
					? toProviderInfo(resolved.provider as any)
					: undefined;

				const context: ToolContext = {
					sessionId: ctx.sessionId ?? crypto.randomUUID(),
					signal: ctx.mcpReq.signal,
					meta: {
						progressToken: ctx.mcpReq._meta?.progressToken,
						requestId: requestId?.toString(),
					},
					authStrategy: resolved?.authStrategy,
					providerToken: resolved?.providerToken,
					provider: providerInfo,
					resolvedHeaders: resolved?.resolvedHeaders,
				} as ToolContext;

				const result = await executeSharedTool(
					tool.name,
					args as Record<string, unknown>,
					context,
				);
				return result as CallToolResult;
			},
		);
	}

	logger.info("tools", { message: `Registered ${sharedTools.length} tools` });
}
