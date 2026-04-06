import type { ServerCapabilities } from "@modelcontextprotocol/server";

export function buildCapabilities(): ServerCapabilities {
	return {
		logging: {},
		prompts: {
			listChanged: true,
		},
		resources: {
			listChanged: true,
			subscribe: true,
		},
		tools: {
			listChanged: true,
		},
	};
}
