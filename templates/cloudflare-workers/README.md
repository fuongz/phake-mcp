# Cloudflare Workers MCP Server

An MCP (Model Context Protocol) server template for Cloudflare Workers.

## Quick Start

```bash
# Install dependencies
bun install

# Development
bun run dev

# Deploy to Cloudflare
bun run deploy
```

## Configuration

### 1. Create KV Namespace

```bash
wrangler kv namespace create TOKENS
```

### 2. Update wrangler.jsonc

Add your KV namespace ID:

```jsonc
{
  "kv_namespaces": [
    {
      "binding": "TOKENS",
      "id": "your-kv-namespace-id"
    }
  ]
}
```

### 3. Set Encryption Key

```bash
# Generate key
openssl rand -base64 32 | tr '+/' '-_' | tr -d '='

# Set as secret
wrangler secret put RS_TOKENS_ENC_KEY
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TOKENS` | Yes | KV namespace binding |
| `RS_TOKENS_ENC_KEY` | Yes | AES-256-GCM encryption key |
| `OAUTH_CLIENT_ID` | No | OAuth client ID |
| `OAUTH_CLIENT_SECRET` | No | OAuth client secret |
| `AUTH_STRATEGY` | No | `oauth`, `bearer`, `api_key`, `custom`, `none` |

## Add Tools

Edit `src/index.ts` to add your own tools:

```typescript
import { defineTool } from "@phake/mcp";
import { z } from "zod";

const tools = [
  defineTool({
    name: "my_tool",
    description: "My custom tool",
    inputSchema: z.object({
      param: z.string().describe("Parameter description"),
    }),
    handler: async (args) => {
      // Your logic here
      return { content: [{ type: "text", text: "Result" }] };
    },
  }),
];
```

## Connect to Claude

See [@phake/mcp README](https://github.com/fuongz/phake-mcp#client-configuration) for client configuration.