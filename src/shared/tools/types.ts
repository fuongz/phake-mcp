/**
 * Shared tool types for cross-runtime compatibility.
 * These definitions work in both Node.js (Hono) and Cloudflare Workers.
 *
 * Uses Zod for schema validation (works in both runtimes).
 */

import { type ZodObject, type ZodRawShape, z } from "zod";
import type { AuthStrategy } from "../types/auth.js";
import type { ProviderInfo } from "../types/provider.js";

// Re-export for backwards compatibility
export type { AuthStrategy } from "../types/auth.js";

/**
 * Context passed to every tool handler.
 * Provides access to auth, session, and cancellation.
 */
export interface ToolContext<TEnv = object> {
	/** Current MCP session ID */
	sessionId: string;
	/** Abort signal for cancellation support */
	signal?: AbortSignal;
	/** Request metadata from MCP */
	meta?: {
		progressToken?: string | number;
		requestId?: string;
	};

	// ─────────────────────────────────────────────────────────────────────────
	// Authentication
	// ─────────────────────────────────────────────────────────────────────────

	/**
	 * Active auth strategy.
	 * - 'oauth': Full OAuth flow with RS token mapping
	 * - 'bearer': Static bearer token from BEARER_TOKEN env
	 * - 'api_key': Static API key from API_KEY env
	 * - 'custom': Custom headers from CUSTOM_HEADERS env
	 * - 'none': No authentication
	 */
	authStrategy?: AuthStrategy;

	/**
	 * Provider access token (e.g., Google, Spotify, GitHub token).
	 * Use this to call external APIs on behalf of the user.
	 *
	 * For OAuth: the mapped provider token
	 * For Bearer: the BEARER_TOKEN value
	 * For API Key: the API_KEY value
	 *
	 * @example
	 * ```typescript
	 * const response = await fetch('https://api.example.com/data', {
	 *   headers: { Authorization: `Bearer ${context.providerToken}` }
	 * });
	 * ```
	 */
	providerToken?: string;

	/**
	 * Provider information (OAuth only).
	 * Uses camelCase (JS convention) - converted from storage format.
	 */
	provider?: ProviderInfo;

	/**
	 * Resolved headers ready for API calls.
	 * This includes the appropriate auth header based on strategy:
	 * - OAuth: Authorization header with provider token
	 * - Bearer: Authorization header from config
	 * - API Key: Custom header (e.g., x-api-key) from config
	 * - Custom: All custom headers from config
	 *
	 * Use these headers directly in fetch calls:
	 * @example
	 * ```typescript
	 * const response = await fetch('https://api.example.com/data', {
	 *   headers: context.resolvedHeaders
	 * });
	 * ```
	 */
	resolvedHeaders?: Record<string, string>;

	/**
	 * Raw authorization headers from the request (before resolution).
	 * Usually you should use `resolvedHeaders` instead.
	 * @deprecated Use `resolvedHeaders` for API calls
	 */
	authHeaders?: Record<string, string>;

	// ─────────────────────────────────────────────────────────────────────────
	// Cloudflare Bindings (Worker only)
	// ─────────────────────────────────────────────────────────────────────────

	/**
	 * Cloudflare worker bindings (AI, Vectorize, D1, R2, etc.)
	 * Only available when running in Cloudflare Workers.
	 * Type matches the generic TEnv passed to createMCPServer.
	 */
	bindings?: TEnv;
}

/**
 * Type guard to assert providerToken is present.
 * Use this when you know auth is required (e.g., tools with requiresAuth: true).
 */
export function assertProviderToken<TEnv extends object = object>(
	context: ToolContext<TEnv>,
): asserts context is ToolContext<TEnv> & { providerToken: string } {
	if (!context.providerToken) {
		throw new Error("Authentication required");
	}
}

/**
 * Content block in tool results.
 */
export type ToolContentBlock =
	| { type: "text"; text: string }
	| { type: "image"; data: string; mimeType: string }
	| { type: "resource"; uri: string; mimeType?: string; text?: string };

/**
 * Result returned from tool handlers.
 */
export interface ToolResult {
	content: ToolContentBlock[];
	/** If true, indicates the tool encountered an error */
	isError?: boolean;
	/** Structured output matching outputSchema (if defined) */
	structuredContent?: Record<string, unknown>;
}

/**
 * Context passed to handlers of tools that require authentication.
 * The dispatcher guarantees providerToken is present.
 */
export interface AuthenticatedToolContext extends ToolContext {
	providerToken: string;
}

/**
 * Framework-agnostic tool definition using Zod schemas.
 * Can be registered with McpServer (Node) or custom dispatcher (Workers).
 */
export interface SharedToolDefinition<
	TShape extends ZodRawShape = ZodRawShape,
	TEnv extends object = object,
> {
	/** Unique tool name (lowercase, underscores allowed) */
	name: string;
	/** Human-readable title */
	title?: string;
	/** Tool description for LLM */
	description: string;
	/** Zod schema for input validation */
	inputSchema: ZodObject<TShape>;
	/** Optional Zod schema for structured output. Always stored as ZodRawShape (normalized on input). */
	outputSchema?: ZodRawShape;
	/** Tool handler function */
	handler: (
		args: z.infer<ZodObject<TShape>>,
		context: ToolContext<TEnv>,
	) => Promise<ToolResult>;
	/**
	 * Whether this tool requires authentication.
	 * If true, the handler will automatically return an error if providerToken is missing.
	 */
	requiresAuth?: boolean;
	/**
	 * Tool annotations per MCP specification.
	 * These are hints for clients about tool behavior (not enforced by SDK).
	 */
	annotations?: {
		/** Human-readable display title */
		title?: string;
		/** Tool does NOT modify environment (default: false) */
		readOnlyHint?: boolean;
		/** Tool may delete/overwrite data (default: true) */
		destructiveHint?: boolean;
		/** Repeated calls have no additional effect (default: false) */
		idempotentHint?: boolean;
		/** Tool interacts with external entities (default: true) */
		openWorldHint?: boolean;
	};
}

/**
 * Normalizes outputSchema to ZodRawShape.
 * Accepts either ZodRawShape or ZodObject<ZodRawShape> and returns ZodRawShape.
 */
export function normalizeOutputSchema(
	schema: ZodRawShape | ZodObject<any>,
): ZodRawShape {
	if (schema instanceof z.ZodObject) {
		return schema.shape;
	}
	return schema as ZodRawShape;
}

/**
 * Creates a typed error factory with preset default fields.
 * The returned function accepts an error message and merges it into the defaults.
 *
 * @example
 * const fail = toolFail({ ok: false, creators: null, tool_version: VERSION });
 * return fail("spreadsheet_id is required");
 * // → { ok: false, creators: null, tool_version: "...", error: "spreadsheet_id is required" }
 */
export function toolFail<T extends Record<string, unknown>>(
	defaults: T,
): (error: string) => T & { error: string } {
	return (error: string) => ({ ...defaults, error });
}

/** Input type for defineTool — decoupled from SharedToolDefinition for correct Zod 4 TShape inference */
type ToolDefinitionInput<
	TShape extends ZodRawShape,
	OShape extends ZodRawShape = ZodRawShape,
	TEnv extends object = object,
> = {
	name: string;
	title?: string;
	description: string;
	inputSchema: ZodObject<TShape>;
	outputSchema?: OShape | ZodObject<OShape>;
	handler: (
		args: z.infer<ZodObject<TShape>>,
		context: ToolContext<TEnv>,
	) => Promise<ToolResult | Record<string, unknown>>;
	requiresAuth?: boolean;
	annotations?: SharedToolDefinition["annotations"];
	/** Auto-injected into every handler result as tool_version / tool_last_update */
	meta?: {
		version?: string;
		last_update?: string;
	};
};

function isToolResult(value: unknown): value is ToolResult {
	return (
		typeof value === "object" &&
		value !== null &&
		"content" in value &&
		Array.isArray((value as ToolResult).content)
	);
}

/**
 * Helper to create a type-safe tool definition.
 * Handlers can return either a ToolResult or a plain object — plain objects are
 * automatically wrapped as { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result }.
 *
 * If `meta` is provided, tool_version and tool_last_update are automatically
 * injected into every result (including error paths).
 */
export function defineTool<
	TShape extends ZodRawShape,
	OShape extends ZodRawShape = ZodRawShape,
	TEnv extends object = object,
>(
	def: ToolDefinitionInput<TShape, OShape, TEnv>,
): SharedToolDefinition<TShape, TEnv> {
	const {
		outputSchema: rawOutputSchema,
		meta,
		handler: originalHandler,
		...rest
	} = def;
	const outputSchema = rawOutputSchema
		? normalizeOutputSchema(rawOutputSchema)
		: undefined;
	return {
		...rest,
		outputSchema,
		handler: async (args, context) => {
			const result = await originalHandler(args, context);
			const metaFields: Record<string, unknown> = {};
			if (meta?.version !== undefined) metaFields.tool_version = meta.version;
			if (meta?.last_update !== undefined)
				metaFields.tool_last_update = meta.last_update;
			const hasMeta = Object.keys(metaFields).length > 0;
			if (isToolResult(result)) {
				return result;
			}
			const merged = hasMeta ? { ...result, ...metaFields } : result;
			return {
				content: [
					{ type: "text" as const, text: JSON.stringify(merged, null, 2) },
				],
				structuredContent: merged,
			};
		},
	};
}

/**
 * Create a typed array of tools for use with createMCPServer.
 * This helper ensures all tools are typed with the same TEnv without
 * requiring explicit type annotations on each handler.
 *
 * @example
 * ```typescript
 * const tools = createTools<Cloudflare.Env>([
 *   defineTool({ ... }),
 *   defineTool({ ... }),
 * ]);
 *
 * const server = createMCPServer<Cloudflare.Env>({ tools });
 * ```
 */
export function createTools<TEnv extends object>(
	tools: Array<SharedToolDefinition<any, TEnv>>,
): Array<SharedToolDefinition<any, TEnv>> {
	return tools;
}
