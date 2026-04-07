import { createMCPServer, defineTool, type ToolContext } from "@phake/mcp";
import z from "zod";

/**
 * Tool: Get Google OAuth user info
 */
const userInfoTool = defineTool({
	name: "get_user_info",
	description: "Get current user info from Google OAuth",
	requiresAuth: true,
	inputSchema: z.object({
		name: z.string(),
	}),
	async handler(_, context: ToolContext<Env>) {
		const provider = context.provider;
		const test = context.bindings?.TEST;
		if (!provider) {
			return {
				content: [
					{
						type: "text" as const,
						text: "No provider info (not authenticated)",
					},
				],
				isError: true,
			};
		}

		const claims = provider.idTokenClaims as Record<string, unknown> | undefined;

		return {
			content: [
				{
					type: "text" as const,
					text: JSON.stringify(
						{ email: claims?.email, name: claims?.name, sub: claims?.sub },
						null,
						2
					),
				},
			],
		};
	},
});

const server = createMCPServer<Env>({
	tools: [userInfoTool],
});

export default server;
