import { createMCPServer, defineTool } from "@phake/mcp";
import { z } from "zod";

export interface Env {
	TOKENS: KVNamespace;
	RS_TOKENS_ENC_KEY: string;
	OAUTH_CLIENT_ID?: string;
	OAUTH_CLIENT_SECRET?: string;
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
		description: "Say hello to the user",
		inputSchema: z.object({
			name: z.string().describe("Name to greet"),
		}),
		handler: async (args) => {
			return {
				content: [
					{
						type: "text" as const,
						text: `Hello, ${args.name}!`,
					},
				],
			};
		},
	}),
];

const server = createMCPServer({ tools, adapter: "worker" });

export default server;
