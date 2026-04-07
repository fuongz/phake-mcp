# @phake/mcp vs Official MCP SDK

## Overview

| Aspect | @phake/mcp | Official SDK |
|--------|-----------|--------------|
| **Purpose** | Full-featured MCP server framework with auth, storage, and production-ready features | Lightweight protocol SDK |
| **Complexity** | Higher-level abstractions | Lower-level, closer to protocol |
| **Target** | Production deployments with auth needs | Protocol implementation |

## Feature Comparison

### Core MCP Features

| Feature | @phake/mcp | Official SDK |
|---------|-----------|--------------|
| Tools (registerTool) | [x] `defineTool` + `createMCPServer` | [x] `McpServer.registerTool` |
| Resources | [x] | [x] |
| Prompts | [x] | [x] |
| Tool annotations | [x] (readOnlyHint, destructiveHint, idempotentHint) | [x] |
| Input/Output schemas | [x] Zod | [x] Zod/Standard Schema |
| Error handling (isError) | [x] | [x] |
| Logging | [x] | [x] |
| Progress notifications | [x] | [x] |
| Sampling | [x] | [x] |
| Elicitation | [x] | [x] |
| Roots | [x] | [x] |
| Resource templates | [x] | [x] |

### Authentication & Security

| Feature | @phake/mcp | Official SDK |
|---------|-----------|--------------|
| OAuth 2.1 (RS => Provider) | [x] Full flow | [ ] Not built-in |
| OAuth with Google preset | [x] `AUTH_STRATEGY=google` | [ ] Not built-in |
| Bearer token (static) | [x] | [ ] Not built-in |
| API Key | [x] | [ ] Not built-in |
| Custom headers | [x] | [ ] Not built-in |
| Token encryption (AES-256-GCM) | [x] | [ ] Not built-in |
| Token refresh (proactive) | [x] | [ ] Not built-in |
| DNS rebinding protection | [x] | [x] (via middleware) |
| CIMD (SEP-991) | [x] Client metadata validation | [ ] Not built-in |

### Storage & State

| Feature | @phake/mcp | Official SDK |
|---------|-----------|--------------|
| KV-based token store | [x] (Cloudflare KV + memory fallback) | [ ] Not built-in |
| File-based token store | [x] (experimental) | [ ] Not built-in |
| Session store | [x] (KV/SQLite/Memory) | [ ] Not built-in |
| In-memory token store | [x] | [x] (InMemoryTaskStore) |

### Deployment & Runtime

| Feature | @phake/mcp | Official SDK |
|---------|-----------|--------------|
| Cloudflare Workers | [x] Native | [x] (Web Standard) |
| Node.js | [x] (Hono) | [x] |
| Bun/Deno | [x] (via Node adapter) | [x] |
| stdio transport | [x] | [x] |
| Streamable HTTP | [x] (with session management) | [x] |
| Multi-session management | [x] Built-in | [x] (manual) |

### Developer Experience

| Feature | @phake/mcp | Official SDK |
|---------|-----------|--------------|
| Type-safe tool definition | [x] `defineTool` factory | [x] Manual |
| Built-in tools (echo, health) | [x] | [ ] Not built-in |
| Tool registry | [x] | [x] |
| Scaffold CLI | [x] `bun create @phake/mcp` | [ ] Not built-in |
| Hot reload (dev) | [x] via Wrangler | [ ] Manual |
| Package exports | Modular (core, worker, node) | Modular (server, client, middleware) |

### OAuth Flow Details

| Feature | @phake/mcp | Official SDK |
|---------|-----------|--------------|
| PKCE support | [x] | [x] |
| Dynamic client registration | [x] (RFC 7591) | [ ] Not built-in |
| Token revocation | [x] (RFC 7009) | [ ] Not built-in |
| OAuth discovery endpoints | [x] `/.well-known/oauth-*` | [ ] Not built-in |
| Provider token mapping | [x] RS => Provider | [ ] Not built-in |

## When to Use Which

### Use @phake/mcp when:
- You need built-in authentication (OAuth, Google, API key, Bearer)
- Deploying to Cloudflare Workers with KV storage
- Want encrypted token storage at rest
- Need proactive token refresh
- Want quick scaffold with `bun create @phake/mcp`
- Need CIMD client validation

### Use Official SDK when:
- Minimal protocol implementation needed
- Custom auth flow required
- No storage/encryption needs
- Using different frameworks/languages

## Code Comparison

### Registering a Tool

**@phake/mcp:**
```typescript
import { defineTool } from "@phake/mcp";

const tool = defineTool({
  name: "greet",
  inputSchema: z.object({ name: z.string() }),
  handler: async (args) => ({ message: `Hello ${args.name}!` }),
});

const server = createMCPServer({ adapter: "worker", tools: [tool] });
```

**Official SDK:**
```typescript
import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";

const server = new McpServer({ name: "my-server", version: "1.0.0" });
server.registerTool("greet", {
  inputSchema: z.object({ name: z.string() }),
}, async ({ name }) => ({
  content: [{ type: "text", text: `Hello ${name}!` }],
}));
```

## Architecture Summary

```
@phake/mcp
├── Tools (defineTool, registry, execution)
├── Auth Strategies (oauth, google, bearer, api_key, custom)
├── OAuth Flow (PKCE, CIMD, discovery, refresh)
├── Storage (KV, File, SQLite, Memory)
└── Adapters (worker, node)

Official SDK
├── Server (McpServer)
├── Transports (Streamable HTTP, stdio)
├── Middleware (Express, Hono, Node.js)
└── (No built-in auth or storage)
```

## Migration Path

If switching from Official SDK to @phake/mcp:
1. Replace `McpServer` with `createMCPServer`
2. Replace `server.registerTool` with `defineTool` + pass to server
3. Configure `AUTH_STRATEGY` for auth needs
4. Set up `TOKENS` KV binding for storage
5. Add `RS_TOKENS_ENC_KEY` for encryption