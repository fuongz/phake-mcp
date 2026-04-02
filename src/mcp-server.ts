/**
 * MCP Server factory.
 * Creates a configured server for different runtimes.
 */

import {
	createWorkerRouter,
	initializeWorkerStorage,
	shimProcessEnv,
	type WorkerEnv,
} from "./adapters/http-worker/index.js";
import { parseConfig } from "./shared/config/env.js";
import { withCors } from "./shared/http/cors.js";
import type { SharedToolDefinition } from "./shared/tools/types.js";

export interface MCPServerOptions {
	/** Runtime adapter: 'worker' (Cloudflare Workers) or 'node' (Hono/Node.js) */
	adapter: "worker" | "node";
	/** Array of tools to register */
	tools?: SharedToolDefinition<any>[];
}

export interface MCPServer {
	fetch: (request: Request, env: unknown) => Promise<Response>;
}

/**
 * Create an MCP server instance.
 * @param {MCPServerOptions} options - Configuration options
 * @param {string} options.adapter - Runtime adapter: 'worker' (Cloudflare Workers) or 'node' (Hono/Node.js)
 * @param {SharedToolDefinition<any>[]} [options.tools] - Array of tools to register
 * @returns {MCPServer} - MCP server instance
 */
export function createMCPServer(options: MCPServerOptions): MCPServer {
	if (options.adapter === "worker") {
		return createWorkerServer(options.tools);
	}
	throw new Error(`Adapter '${options.adapter}' not supported yet`);
}

/**
 * Create a Cloudflare Workers MCP server.
 */
function createWorkerServer(tools?: SharedToolDefinition[]): MCPServer {
	return {
		async fetch(request: Request, env: unknown): Promise<Response> {
			shimProcessEnv(env as WorkerEnv);
			const config = parseConfig(env as Record<string, unknown>);
			const storage = initializeWorkerStorage(env as WorkerEnv, config);
			if (!storage) {
				return withCors(
					new Response("Server misconfigured: Storage unavailable", {
						status: 503,
					}),
				);
			}
			const router = createWorkerRouter({
				tokenStore: storage.tokenStore,
				sessionStore: storage.sessionStore,
				config,
				tools,
			});
			return router.fetch(request);
		},
	};
}
