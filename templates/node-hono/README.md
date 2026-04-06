# Node.js MCP Server

An MCP (Model Context Protocol) server template for Node.js with Bun.

## Quick Start

```bash
# Install dependencies
bun install

# Start the server
bun run dev
```

## Configuration

Set environment variables in `.dev.vars`:

```bash
# Generate encryption key
openssl rand -base64 32 | tr '+/' '-_' | tr -d '='
```

```ini
RS_TOKENS_ENC_KEY=your-encryption-key
OAUTH_CLIENT_ID=your-client-id
OAUTH_CLIENT_SECRET=your-client-secret
AUTH_STRATEGY=oauth
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
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