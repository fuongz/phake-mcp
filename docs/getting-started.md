# Getting Started

A step-by-step guide to set up @phake/mcp.

## Prerequisites

- [Bun](https://bun.sh) 1.x or Node.js 20+
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) CLI (for Cloudflare Workers deployments)
- A Cloudflare account with Workers and KV access (for Worker deployments)

## Quick Start (Scaffold)

Scaffold a new MCP server with one command:

```bash
# Interactive (prompts for template)
bun create @phake/mcp

# With options
bun create @phake/mcp my-mcp-app --template cloudflare-workers --install
```

### Available Templates

| Template | Description |
|----------|-------------|
| `cloudflare-workers` | Cloudflare Workers + Hono (default) |
| `cloudflare-workers-google` | Cloudflare Workers + Google OAuth |
| `node-hono` | Node.js + Bun + Hono |

### Options

| Option | Description |
|--------|-------------|
| `-t, --template` | Template name |
| `-i, --install` | Auto install dependencies |
| `-p, --pm` | Package manager: `npm`, `bun`, `yarn`, `pnpm` |

## Manual Setup

If you prefer to set up manually, follow these steps:

### 1. Create the KV namespace

```bash
wrangler kv namespace create TOKENS
```

### 2. Bind it in your Wrangler config

Use the namespace ID printed in the previous step.

`wrangler.toml`
```toml
[[kv_namespaces]]
binding = "TOKENS"
id = "<your-kv-namespace-id>"
```

`wrangler.jsonc`
```jsonc
{
  "kv_namespaces": [
    {
      "binding": "TOKENS",
      "id": "<your-kv-namespace-id>"
    }
  ]
}
```

### 3. Generate an encryption key

Tokens at rest are encrypted with AES-256-GCM. Generate a 32-byte key:

```bash
# OpenSSL
openssl rand -base64 32 | tr '+/' '-_' | tr -d '='

# Node.js
node -e "const {randomBytes}=require('crypto'); console.log(randomBytes(32).toString('base64url'))"
```

### 4. Set the encryption key

**Production** - add as a Wrangler secret:

```bash
wrangler secret put RS_TOKENS_ENC_KEY
# paste the generated key when prompted
```

**Local development** - add to `.dev.vars`:

```ini
RS_TOKENS_ENC_KEY=<your-generated-key>
```

### 5. Create your Worker

```typescript
import { createMCPServer } from "@phake/mcp";

const server = createMCPServer({
  adapter: "worker",
  tools: [
    // your tool definitions
  ],
});

export default server;
```

## Defining Tools

Use `defineTool` to create a type-safe tool, then pass it to `createMCPServer`.

```typescript
import { z } from "zod";
import { defineTool } from "@phake/mcp";

const greetTool = defineTool({
  name: "greet",
  title: "Greet User",
  description: "Returns a greeting for the given name",
  inputSchema: z.object({
    name: z.string().describe("Name to greet"),
  }),
  outputSchema: z.object({
    message: z.string().describe("The greeting message"),
  }),
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
  },
  handler: async (args) => {
    return { message: `Hello, ${args.name}!` };
  },
});
```

### Tool Definition Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Unique tool identifier |
| `description` | `string` | Yes | Description shown to the LLM |
| `inputSchema` | `ZodObject` | Yes | Zod schema for input validation |
| `outputSchema` | `ZodRawShape \| ZodObject` | No | Zod schema for structured output |
| `handler` | `function` | Yes | `(args, context) => Promise<ToolResult \| Record<string, unknown>>` |
| `requiresAuth` | `boolean` | No | Reject calls without a provider token |
| `title` | `string` | No | Human-readable display title |
| `annotations` | `object` | No | MCP hints (`readOnlyHint`, `destructiveHint`, etc.) |
| `meta` | `{ version?, last_update? }` | No | Auto-injected into every result as `tool_version` / `tool_last_update` |

### Handler Return Values

Handlers can return either a full `ToolResult` or a plain object. Plain objects are automatically wrapped as structured content:

```typescript
// Plain object - auto-wrapped
handler: async (args) => ({ greeting: `Hello, ${args.name}!` })

// Full ToolResult - passed through unchanged
handler: async (args) => ({
  content: [{ type: "text", text: `Hello, ${args.name}!` }],
  structuredContent: { greeting: `Hello, ${args.name}!` },
})
```

## Authenticated Tools

Set `requiresAuth: true` to have the dispatcher automatically reject unauthenticated calls. Use `context.resolvedHeaders` to forward auth to external APIs.

```typescript
const profileTool = defineTool({
  name: "get_profile",
  description: "Fetch the authenticated user's profile",
  inputSchema: z.object({}),
  requiresAuth: true,
  handler: async (_args, context) => {
    const response = await fetch("https://api.example.com/me", {
      headers: context.resolvedHeaders,
    });
    return await response.json();
  },
});
```

### Context Properties

| Property | Description |
|----------|-------------|
| `sessionId` | Current MCP session ID |
| `providerToken` | Access token for external API calls |
| `resolvedHeaders` | Ready-to-use auth headers for `fetch` |
| `authStrategy` | Active auth strategy (`oauth`, `google`, `bearer`, `api_key`, `custom`, `none`) |
| `provider` | Provider info (OAuth only) |
| `signal` | `AbortSignal` for cancellation support |

Use the `assertProviderToken` helper to narrow the context type when you need a guaranteed token:

```typescript
import { assertProviderToken } from "@phake/mcp";

handler: async (_args, context) => {
  assertProviderToken(context); // throws if missing
  // context.providerToken is now typed as string
},
```

## Next Steps

- [Authentication Guide](./authentication.md) - Configure auth strategies
- [Client Configuration](./client-config.md) - Setup MCP clients
- [Configuration Reference](./configuration.md) - All environment variables
