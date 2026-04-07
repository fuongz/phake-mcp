/**
 * MCP Server factory.
 * Creates a configured server for different runtimes.
 */

import {
	createWorkerRouter,
	initializeWorkerStorage,
	type RouterContext,
	shimProcessEnv,
	type WorkerEnv,
} from "./adapters/http-worker/index.js";
import { parseConfig } from "./shared/config/env.js";
import { withCors } from "./shared/http/cors.js";
import type {
	SharedToolDefinition,
	ToolContext,
} from "./shared/tools/types.js";

export interface MCPServerOptions<
	_TBindings extends Record<string, unknown> = Record<string, unknown>,
> {
	/** Array of tools to register */
	tools?: SharedToolDefinition<any>[];
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
export function createMCPServer<
	TBindings extends Record<string, unknown> = Record<string, unknown>,
>(options: MCPServerOptions<TBindings>): MCPServer {
	return {
		async fetch(request: Request, env: unknown): Promise<Response> {
			const workerEnv = env as WorkerEnv & TBindings;
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

			// Extract Cloudflare bindings from worker env
			const bindings: ToolContext["bindings"] = {} as ToolContext["bindings"];
			for (const key of Object.keys(workerEnv)) {
				if (key !== "TOKENS" && key !== "RS_TOKENS_ENC_KEY") {
					(bindings as Record<string, unknown>)[key] =
						workerEnv[key as keyof TBindings];
				}
			}

			const router = createWorkerRouter({
				tokenStore: storage.tokenStore,
				sessionStore: storage.sessionStore,
				config,
				tools: options.tools,
				bindings: bindings as RouterContext["bindings"],
			});
			return router.fetch(request);
		},
	};
}
