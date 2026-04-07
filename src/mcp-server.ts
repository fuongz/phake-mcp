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

export interface MCPServerOptions<TEnv extends object = object> {
	/** Array of tools to register */
	tools?: SharedToolDefinition<any, TEnv>[];
}

export interface MCPServer {
	fetch: (request: Request, env: unknown) => Promise<Response>;
}

/**
 * Create an MCP server instance for Cloudflare Workers.
 * @example
 * ```typescript
 * interface MyEnv {
 *   AI: unknown;
 *   VECTORIZE: unknown;
 *   MY_BUCKET: unknown;
 * }
 *
 * const server = createMCPServer<MyEnv>({
 *   tools: [myTool],
 * });
 * ```
 */
export function createMCPServer<TEnv extends object = object>(
	options: MCPServerOptions<TEnv>,
): MCPServer {
	return {
		async fetch(request: Request, env: unknown): Promise<Response> {
			const workerEnv = env as WorkerEnv & TEnv;
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

			// Extract Cloudflare bindings from worker env (as TEnv type)
			const bindings: TEnv = workerEnv as TEnv;

			const router = createWorkerRouter<TEnv>({
				tokenStore: storage.tokenStore,
				sessionStore: storage.sessionStore,
				config,
				tools: options.tools as any,
				bindings,
			});
			return router.fetch(request);
		},
	};
}
