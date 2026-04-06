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
	/** Array of tools to register */
	tools?: SharedToolDefinition<any>[];
}

export interface MCPServer {
	fetch: (request: Request, env: unknown) => Promise<Response>;
}

/**
 * Create an MCP server instance for Cloudflare Workers.
 * @param {MCPServerOptions} options - Configuration options
 * @param {SharedToolDefinition<any>[]} [options.tools] - Array of tools to register
 * @returns {MCPServer} - MCP server instance
 */
export function createMCPServer(options: MCPServerOptions): MCPServer {
	return {
		async fetch(request: Request, env: unknown): Promise<Response> {
			const workerEnv = env as WorkerEnv;
			shimProcessEnv(workerEnv);
			const config = parseConfig(workerEnv);
			const storage = initializeWorkerStorage(workerEnv, config);
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
				tools: options.tools,
			});
			return router.fetch(request);
		},
	};
}
