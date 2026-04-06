import { describe, expect, test } from "bun:test";
import {
	createWorkerRouter,
	type KVNamespace,
	type RouterContext,
} from "../../adapters/http-worker/index.js";
import type { UnifiedConfig } from "../../shared/config/env.js";
import type {
	SessionStore,
	TokenStore,
} from "../../shared/storage/interface.js";
import {
	MemorySessionStore,
	MemoryTokenStore,
} from "../../shared/storage/memory.js";
import { echoTool } from "../../shared/tools/echo.js";

interface MockKVNamespace extends KVNamespace {
	store: Map<string, string>;
}

function createMockKV(): MockKVNamespace {
	return {
		store: new Map(),
		async get(key: string) {
			return this.store.get(key) ?? null;
		},
		async put(
			key: string,
			value: string,
			_options?: { expiration?: number; expirationTtl?: number },
		) {
			this.store.set(key, value);
		},
		async delete(key: string) {
			this.store.delete(key);
		},
	};
}

function createMockConfig(overrides = {}): UnifiedConfig {
	return {
		HOST: "127.0.0.1",
		PORT: 3000,
		NODE_ENV: "test",
		MCP_TITLE: "Test MCP",
		MCP_VERSION: "1.0.0",
		MCP_INSTRUCTIONS: "Test instructions",
		MCP_PROTOCOL_VERSION: "2025-06-18",
		MCP_ACCEPT_HEADERS: [],
		AUTH_STRATEGY: "none",
		AUTH_ENABLED: false,
		AUTH_REQUIRE_RS: false,
		AUTH_ALLOW_DIRECT_BEARER: false,
		API_KEY_HEADER: "x-api-key",
		OAUTH_SCOPES: "",
		OAUTH_REDIRECT_URI: "http://localhost:3000/callback",
		OAUTH_REDIRECT_ALLOWLIST: [],
		OAUTH_REDIRECT_ALLOW_ALL: false,
		CIMD_ENABLED: true,
		CIMD_FETCH_TIMEOUT_MS: 5000,
		CIMD_MAX_RESPONSE_BYTES: 65536,
		CIMD_ALLOWED_DOMAINS: [],
		RPS_LIMIT: 10,
		CONCURRENCY_LIMIT: 5,
		LOG_LEVEL: "info",
		...overrides,
	};
}

function createTestRouter(config = {}): {
	router: { fetch: (request: Request) => Promise<Response> };
	tokenStore: TokenStore;
	sessionStore: SessionStore;
	config: UnifiedConfig;
} {
	const _mockKV = createMockKV();
	const tokenStore = new MemoryTokenStore();
	const sessionStore = new MemorySessionStore();

	type WorkerTool = import("../../shared/tools/types.js").SharedToolDefinition;

	const ctx: RouterContext = {
		tokenStore,
		sessionStore,
		config: createMockConfig(config),
		tools: [echoTool as unknown as WorkerTool],
	};

	const router = createWorkerRouter(ctx);
	return { router, tokenStore, sessionStore, config: ctx.config };
}

async function parseJsonRpcResponse(response: Response): Promise<unknown> {
	const text = await response.text();
	return JSON.parse(text);
}

describe("Cloudflare Worker MCP Handler - User Scenario Tests", () => {
	test("full MCP session lifecycle - initialize, list tools, call tool", async () => {
		const { router, sessionStore } = createTestRouter();

		const initializeRequest = new Request("http://localhost/mcp", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				jsonrpc: "2.0",
				method: "initialize",
				params: {
					protocolVersion: "2025-06-18",
					capabilities: {},
					clientInfo: { name: "test-client", version: "1.0.0" },
				},
				id: 1,
			}),
		});

		const initResponse = await router.fetch(initializeRequest);
		expect(initResponse.status).toBe(200);

		const sessionId = initResponse.headers.get("Mcp-Session-Id");
		expect(sessionId).toBeDefined();

		const initResult = await parseJsonRpcResponse(initResponse);
		expect(initResult).toMatchObject({
			jsonrpc: "2.0",
			id: 1,
		});
		expect(
			(initResult as { result?: { protocolVersion?: string } }).result,
		).toBeDefined();

		const validSessionId = sessionId as string;
		const session = await sessionStore.get(validSessionId);
		expect(session).toBeDefined();
		expect(session?.protocolVersion).toBe("2025-06-18");

		const toolsListRequest = new Request("http://localhost/mcp", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Mcp-Session-Id": validSessionId,
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				method: "tools/list",
				params: {},
				id: 2,
			}),
		});

		const toolsResponse = await router.fetch(toolsListRequest);
		expect(toolsResponse.status).toBe(200);

		const toolsResult = await parseJsonRpcResponse(toolsResponse);
		const tr = toolsResult as { result?: { tools?: Array<{ name: string }> } };
		expect(tr.result?.tools?.map((t) => t.name)).toContain("echo");

		const echoRequest = new Request("http://localhost/mcp", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Mcp-Session-Id": validSessionId,
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				method: "tools/call",
				params: {
					name: "echo",
					arguments: { message: "hello world", uppercase: true },
				},
				id: 3,
			}),
		});

		const echoResponse = await router.fetch(echoRequest);
		expect(echoResponse.status).toBe(200);

		const echoResult = await parseJsonRpcResponse(echoResponse);
		const er = echoResult as {
			result?: { content?: Array<{ type: string; text: string }> };
		};
		expect(er.result?.content?.[0]?.text).toBe("HELLO WORLD");

		const deleteRequest = new Request("http://localhost/mcp", {
			method: "DELETE",
			headers: {
				"Mcp-Session-Id": validSessionId,
			},
		});

		const deleteResponse = await router.fetch(deleteRequest);
		expect(deleteResponse.status).toBe(202);

		const deletedSession = await sessionStore.get(validSessionId);
		expect(deletedSession).toBeNull();
	});

	test("returns 405 for GET on /mcp", async () => {
		const { router } = createTestRouter();

		const getRequest = new Request("http://localhost/mcp", {
			method: "GET",
		});

		const response = await router.fetch(getRequest);
		expect(response.status).toBe(405);
	});

	test("returns 404 for unknown routes", async () => {
		const { router } = createTestRouter();

		const unknownRequest = new Request("http://localhost/unknown", {
			method: "GET",
		});

		const response = await router.fetch(unknownRequest);
		expect(response.status).toBe(404);
	});

	test("returns 400 when session id missing on non-initialize", async () => {
		const { router } = createTestRouter();

		const request = new Request("http://localhost/mcp", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				jsonrpc: "2.0",
				method: "tools/list",
				params: {},
				id: 1,
			}),
		});

		const response = await router.fetch(request);
		expect(response.status).toBe(400);

		const result = await parseJsonRpcResponse(response);
		expect(result).toMatchObject({
			jsonrpc: "2.0",
			error: { code: -32000, message: "Bad Request: Mcp-Session-Id required" },
			id: null,
		});
	});

	test("validates session exists for subsequent requests", async () => {
		const { router } = createTestRouter();

		const request = new Request("http://localhost/mcp", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Mcp-Session-Id": "non-existent-session",
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				method: "tools/list",
				params: {},
				id: 1,
			}),
		});

		const response = await router.fetch(request);
		expect(response.status).toBe(404);
	});

	test("handles notification (no id) with 202 response", async () => {
		const { router } = createTestRouter();

		const initRequest = new Request("http://localhost/mcp", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				jsonrpc: "2.0",
				method: "initialize",
				params: {
					protocolVersion: "2025-06-18",
					capabilities: {},
					clientInfo: { name: "test", version: "1.0" },
				},
			}),
		});

		const response = await router.fetch(initRequest);
		expect(response.status).toBe(202);
	});

	test("supports batch JSON-RPC with multiple requests", async () => {
		const { router } = createTestRouter();

		const initRequest = new Request("http://localhost/mcp", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify([
				{
					jsonrpc: "2.0",
					method: "initialize",
					params: {
						protocolVersion: "2025-06-18",
						capabilities: {},
						clientInfo: { name: "test", version: "1.0" },
					},
					id: 1,
				},
				{
					jsonrpc: "2.0",
					method: "tools/list",
					params: {},
					id: 2,
				},
			]),
		});

		const response = await router.fetch(initRequest);
		// Batch with initialize returns 202 per MCP spec (creates session)
		expect(response.status).toBe(202);
	});

	test("health endpoint returns ok status", async () => {
		const { router } = createTestRouter();

		const healthRequest = new Request("http://localhost/health", {
			method: "GET",
		});

		const response = await router.fetch(healthRequest);
		expect(response.status).toBe(200);

		const result = await parseJsonRpcResponse(response);
		expect(result).toMatchObject({ status: "ok" });
		expect(typeof (result as { timestamp: number }).timestamp).toBe("number");
	});

	test("oauth discovery endpoints return correct metadata", async () => {
		const { router } = createTestRouter();

		const oauthServerRequest = new Request(
			"http://localhost/.well-known/oauth-authorization-server",
			{ method: "GET" },
		);

		const oauthServerResponse = await router.fetch(oauthServerRequest);
		expect(oauthServerResponse.status).toBe(200);

		const metadata = await parseJsonRpcResponse(oauthServerResponse);
		expect(metadata).toMatchObject({
			issuer: expect.any(String),
			authorization_endpoint: expect.any(String),
			token_endpoint: expect.any(String),
			grant_types_supported: expect.arrayContaining(["authorization_code"]),
		});

		const protectedResourceRequest = new Request(
			"http://localhost/.well-known/oauth-protected-resource",
			{ method: "GET" },
		);

		const protectedResourceResponse = await router.fetch(
			protectedResourceRequest,
		);
		expect(protectedResourceResponse.status).toBe(200);

		const prMetadata = await parseJsonRpcResponse(protectedResourceResponse);
		expect(prMetadata).toMatchObject({
			resource: expect.any(String),
			authorization_servers: expect.any(Array),
		});
	});
});
