import { createMCPServer, defineTool } from "@phake/mcp";
import { z } from "zod";

export interface Env {
	TOKENS: KVNamespace;
	RS_TOKENS_ENC_KEY: string;

	// OAuth client (your app)
	OAUTH_CLIENT_ID?: string;
	OAUTH_CLIENT_SECRET?: string;

	// Google OAuth provider
	PROVIDER_CLIENT_ID?: string;
	PROVIDER_CLIENT_SECRET?: string;
	PROVIDER_ACCOUNTS_URL?: string;
	OAUTH_SCOPES?: string;
}

export interface KVNamespace {
	get(key: string): Promise<string | null>;
	put(
		key: string,
		value: string,
		options?: { expiration?: number; expirationTtl?: number },
	): Promise<void>;
	delete(key: string): Promise<void>;
}

const tools = [
	defineTool({
		name: "hello",
		description: "Say hello to the authenticated user",
		inputSchema: z.object({
			name: z.string().describe("Name to greet"),
		}),
		handler: async (args, context) => {
			const hasToken = !!context.providerToken;
			return {
				content: [
					{
						type: "text" as const,
						text: `Hello, ${args.name}! Auth: ${hasToken}`,
					},
				],
			};
		},
		requiresAuth: true,
	}),
];

const server = createMCPServer({ tools, adapter: "worker" });

export default server;
