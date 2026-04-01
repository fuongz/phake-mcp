// MCP routes for Hono
/** biome-ignore-all lint/style/noNonNullAssertion: no need */
// Simplified provider-agnostic version from Spotify MCP

import { randomUUID } from "node:crypto";
import type { HttpBindings } from "@hono/node-server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Hono } from "hono";
import {
	authContextStorage,
	contextRegistry,
} from "../../../../runtime/node/context.js";
import type { parseConfig } from "../../../../shared/config/env.js";
import { getSessionStore } from "../../../../shared/storage/singleton.js";
import type { RequestContext } from "../../../../shared/types/context.js";
import { createCancellationToken } from "../../../../shared/utils/cancellation.js";
import { sharedLogger as logger } from "../../../../shared/utils/logger.js";
import type { AuthContext } from "../middlewares/auth.js";

/**
 * Hono context with auth middleware extension.
 */
interface HonoContextWithAuth {
	authContext?: AuthContext;
}

type JsonRpcLike = {
	method?: string;
	params?: Record<string, unknown>;
};

function getJsonRpcMessages(body: unknown): JsonRpcLike[] {
	if (!body || typeof body !== "object") return [];
	if (Array.isArray(body)) {
		return body.filter(
			(msg) => msg && typeof msg === "object",
		) as JsonRpcLike[];
	}
	return [body as JsonRpcLike];
}

function resolveSessionApiKey(
	authContext?: AuthContext,
	config?: ReturnType<typeof parseConfig>,
): string {
	const headers = authContext?.authHeaders ?? {};
	const apiKeyHeader = config?.API_KEY_HEADER?.toLowerCase() ?? "x-api-key";

	const directApiKey =
		headers[apiKeyHeader] ?? headers["x-api-key"] ?? headers["x-auth-token"];
	if (directApiKey) return directApiKey;

	if (authContext?.rsToken) return authContext.rsToken;

	const authHeader = headers.authorization;
	if (authHeader) {
		const match = authHeader.match(/^\s*Bearer\s+(.+)$/i);
		return match?.[1] ?? authHeader;
	}

	if (config?.API_KEY) return config.API_KEY;

	return "public";
}

export function buildMcpRoutes(params: {
	server: McpServer;
	transports: Map<string, StreamableHTTPServerTransport>;
}) {
	const { server, transports } = params;
	// const config = parseConfig(process.env as Record<string, unknown>);
	const app = new Hono<{ Bindings: HttpBindings }>();
	const sessionStore = getSessionStore();

	const connectedStreamableHTTPServerTransports =
		new WeakSet<StreamableHTTPServerTransport>();

	const MCP_SESSION_HEADER = "Mcp-Session-Id";

	async function ensureConnected(
		transport: StreamableHTTPServerTransport,
	): Promise<void> {
		if (!connectedStreamableHTTPServerTransports.has(transport)) {
			await server.connect(transport);
			connectedStreamableHTTPServerTransports.add(transport);
		}
	}

	/**
	 * Shared handler for all HTTP methods. Since StreamableHTTPServerTransport
	 * accepts a standard Request and returns a standard Response, we pass c.req.raw
	 * directly — no toReqRes/toFetchResponse shim needed.
	 */
	async function handleMcpRequest(
		c: import("hono").Context<{ Bindings: HttpBindings }>,
	) {
		let requestId: string | number | undefined;

		try {
			const sessionIdHeader = c.req.header(MCP_SESSION_HEADER) ?? undefined;
			let body: unknown;
			try {
				body = await c.req.json();
			} catch {
				body = undefined;
			}

			const messages = getJsonRpcMessages(body);
			const isInitialize = messages.some((msg) => msg.method === "initialize");
			const isInitialized = messages.some(
				(msg) => msg.method === "initialized",
			);
			const initMessage = messages.find((msg) => msg.method === "initialize");
			const protocolVersion =
				typeof (initMessage?.params as { protocolVersion?: string } | undefined)
					?.protocolVersion === "string"
					? (initMessage?.params as { protocolVersion?: string })
							.protocolVersion
					: undefined;

			const method = c.req.method;

			if (method === "POST" && !isInitialize && !sessionIdHeader) {
				return c.json(
					{
						jsonrpc: "2.0",
						error: {
							code: -32000,
							message: "Bad Request: Mcp-Session-Id required",
						},
						id: null,
					},
					400,
				);
			}

			if ((method === "GET" || method === "DELETE") && !sessionIdHeader) {
				return c.json(
					{
						jsonrpc: "2.0",
						error: { code: -32000, message: "Method not allowed - no session" },
						id: null,
					},
					405,
				);
			}

			const plannedSid = isInitialize ? randomUUID() : undefined;
			const sessionId = plannedSid ?? sessionIdHeader;

			const authContext = (c as unknown as HonoContextWithAuth).authContext;
			const apiKey = resolveSessionApiKey(authContext);

			let existingSession: Awaited<ReturnType<typeof sessionStore.get>> | null =
				null;
			if (!isInitialize && sessionIdHeader) {
				try {
					existingSession = await sessionStore.get(sessionIdHeader);
				} catch (error) {
					void logger.warning("mcp_session", {
						message: "Session lookup failed",
						error: (error as Error).message,
					});
				}
				if (!existingSession) {
					const staleStreamableHTTPServerTransport =
						transports.get(sessionIdHeader);
					if (staleStreamableHTTPServerTransport) {
						transports.delete(sessionIdHeader);
						staleStreamableHTTPServerTransport.close();
					}
					return c.text("Invalid session", 404);
				}
			}

			if (
				sessionId &&
				!isInitialize &&
				existingSession?.apiKey &&
				existingSession.apiKey !== apiKey
			) {
				void logger.warning("mcp_session", {
					message: "Request API key differs from session binding",
					sessionId,
					originalApiKey: `${existingSession.apiKey.slice(0, 8)}...`,
					requestApiKey: `${apiKey.slice(0, 8)}...`,
				});
			}

			if (sessionId && isInitialized) {
				try {
					await sessionStore.update(sessionId, { initialized: true });
				} catch (error) {
					void logger.warning("mcp_session", {
						message: "Failed to update session initialized flag",
						error: (error as Error).message,
					});
				}
			}

			void logger.info("mcp_request", {
				message: "Processing MCP request",
				sessionId,
				isInitialize,
				hasSessionIdHeader: !!sessionIdHeader,
				requestMethod: method,
				bodyMethod: messages[0]?.method,
			});

			let transport = sessionIdHeader
				? transports.get(sessionIdHeader)
				: undefined;
			if (!transport) {
				if (!isInitialize) {
					if (sessionIdHeader) {
						void sessionStore.delete(sessionIdHeader).catch(() => {});
					}
					return c.text("Invalid session", 404);
				}
				const created = new StreamableHTTPServerTransport({
					sessionIdGenerator: () => sessionId as string,
					onsessioninitialized: async (sid: string) => {
						transports.set(sid, created);
						try {
							await sessionStore.create(sid, apiKey);
							if (protocolVersion) {
								await sessionStore.update(sid, { protocolVersion });
							}
						} catch (error) {
							void logger.warning("mcp_session", {
								message: "Failed to create session record",
								error: (error as Error).message,
							});
						}
						void logger.info("mcp", {
							message: "Session initialized",
							sessionId: sid,
						});
					},
					onsessionclosed: (sid: string) => {
						transports.delete(sid);
						void sessionStore.delete(sid).catch(() => {});
						contextRegistry.deleteBySession(sid);
					},
				});
				transport = created;
			}

			transport.onerror = (error) => {
				void logger.error("transport", {
					message: "StreamableHTTPServerTransport error",
					error: error.message,
				});
			};

			requestId =
				body && typeof body === "object" && "id" in body
					? (body.id as string | number)
					: undefined;

			const requestContext: RequestContext = {
				sessionId: plannedSid ?? sessionIdHeader,
				cancellationToken: createCancellationToken(),
				requestId,
				timestamp: Date.now(),
				authStrategy: authContext?.strategy,
				authHeaders: authContext?.authHeaders,
				resolvedHeaders: authContext?.resolvedHeaders,
				providerToken: authContext?.providerToken,
				provider: authContext?.provider,
				rsToken: authContext?.rsToken,
			};

			if (requestId) {
				contextRegistry.create(requestId, plannedSid ?? sessionIdHeader, {
					authStrategy: authContext?.strategy,
					authHeaders: authContext?.authHeaders,
					resolvedHeaders: authContext?.resolvedHeaders,
					providerToken: authContext?.providerToken,
					provider: authContext?.provider,
					rsToken: authContext?.rsToken,
				});
			}

			await ensureConnected(transport);

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const response = await authContextStorage.run(requestContext, () =>
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(transport as any).handleRequest(c.req.raw, {
					parsedBody: body,
				} as any),
			);

			if (method === "DELETE") {
				const cleanedCount = contextRegistry.deleteBySession(sessionIdHeader!);
				void logger.info("mcp", {
					message: "Session terminated, contexts cleaned up",
					sessionId: sessionIdHeader,
					cleanedContexts: cleanedCount,
				});
				transports.delete(sessionIdHeader!);
				transport.close();
				await sessionStore.delete(sessionIdHeader!).catch(() => {});
			}

			return response;
		} catch (error) {
			if (requestId !== undefined) {
				contextRegistry.delete(requestId);
			}
			void logger.error("mcp", {
				message: "Error handling request",
				error: (error as Error).message,
			});
			return c.json(
				{
					jsonrpc: "2.0",
					error: { code: -32603, message: "Internal server error" },
					id: null,
				},
				500,
			);
		}
	}

	app.post("/", handleMcpRequest);
	app.get("/", handleMcpRequest);
	app.delete("/", handleMcpRequest);

	return app;
}
