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
import { sharedLogger } from "./shared/utils/logger.js";

export interface MCPServerOptions<TEnv extends object = object> {
	/** Array of tools to register */
	tools?: SharedToolDefinition<any, TEnv>[];
	/**
	 * Enable debug mode - logs all MCP client => server requests to console.
	 * Sensitive headers (authorization, cookie, x-api-key) are redacted by default.
	 * @default false
	 */
	debug?: boolean;
	/**
	 * Enable developer mode - reveals sensitive header values in debug logs.
	 * Only takes effect when debug is also true.
	 * WARNING: may expose tokens in console output - use only in local development.
	 * @default false
	 */
	developerMode?: boolean;
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
	const debug = options.debug ?? false;
	const developerMode = debug && (options.developerMode ?? false);

	if (debug) {
		sharedLogger.setLevel("debug");
		sharedLogger.debug("mcp_server", {
			message: developerMode
				? "Debug mode enabled (developerMode: sensitive headers visible)"
				: "Debug mode enabled",
		});
	}

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
				debug,
				developerMode,
			});
			return router.fetch(request);
		},
	};
}
