import { createMCPServer, defineTool } from "@phake/mcp";
import { z } from "zod";

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

const server = createMCPServer({ tools, adapter: "node" });

export default server;
