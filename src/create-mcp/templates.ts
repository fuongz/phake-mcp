export const templates = [
	{
		value: "cloudflare-workers",
		description: "Cloudflare Workers + Hono (default)",
	},
	{
		value: "cloudflare-workers-google",
		description: "Cloudflare Workers + Google OAuth",
	},
	{
		value: "node-hono",
		description: "Node.js + Hono",
	},
] as const;

export const knownPackageManagerNames = ["npm", "bun", "yarn", "pnpm"] as const;

export type PackageManagerName = (typeof knownPackageManagerNames)[number];
