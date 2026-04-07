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
| Tools (registerTool) | ✅ `defineTool` + `createMCPServer` | ✅ `McpServer.registerTool` |
| Resources | ✅ | ✅ |
| Prompts | ✅ | ✅ |
| Tool annotations | ✅ (readOnlyHint, destructiveHint, idempotentHint) | ✅ |
| Input/Output schemas | ✅ Zod | ✅ Zod/Standard Schema |
| Error handling (isError) | ✅ | ✅ |
| Logging | ✅ | ✅ |
| Progress notifications | ✅ | ✅ |
| Sampling | ✅ | ✅ |
| Elicitation | ✅ | ✅ |
| Roots | ✅ | ✅ |
| Resource templates | ✅ | ✅ |

### Authentication & Security

| Feature | @phake/mcp | Official SDK |
|---------|-----------|--------------|
| OAuth 2.1 (RS → Provider) | ✅ Full flow | ❌ Not built-in |
| OAuth with Google preset | ✅ `AUTH_STRATEGY=google` | ❌ Not built-in |
| Bearer token (static) | ✅ | ❌ Not built-in |
| API Key | ✅ | ❌ Not built-in |
| Custom headers | ✅ | ❌ Not built-in |
| Token encryption (AES-256-GCM) | ✅ | ❌ Not built-in |
| Token refresh (proactive) | ✅ | ❌ Not built-in |
| DNS rebinding protection | ✅ | ✅ (via middleware) |
| CIMD (SEP-991) | ✅ Client metadata validation | ❌ Not built-in |

### Storage & State

| Feature | @phake/mcp | Official SDK |
|---------|-----------|--------------|
| KV-based token store | ✅ (Cloudflare KV + memory fallback) | ❌ Not built-in |
| File-based token store | ✅ (experimental) | ❌ Not built-in |
| Session store | ✅ (KV/SQLite/Memory) | ❌ Not built-in |
| In-memory token store | ✅ | ✅ (InMemoryTaskStore) |

### Deployment & Runtime

| Feature | @phake/mcp | Official SDK |
|---------|-----------|--------------|
| Cloudflare Workers | ✅ Native | ✅ (Web Standard) |
| Node.js | ✅ (Hono) | ✅ |
| Bun/Deno | ✅ (via Node adapter) | ✅ |
| stdio transport | ✅ | ✅ |
| Streamable HTTP | ✅ (with session management) | ✅ |
| Multi-session management | ✅ Built-in | ✅ (manual) |

### Developer Experience

| Feature | @phake/mcp | Official SDK |
|---------|-----------|--------------|
| Type-safe tool definition | ✅ `defineTool` factory | ✅ Manual |
| Built-in tools (echo, health) | ✅ | ❌ Not built-in |
| Tool registry | ✅ | ✅ |
| Scaffold CLI | ✅ `bun create @phake/mcp` | ❌ Not built-in |
| Hot reload (dev) | ✅ via Wrangler | ❌ Manual |
| Package exports | Modular (core, worker, node) | Modular (server, client, middleware) |

### OAuth Flow Details

| Feature | @phake/mcp | Official SDK |
|---------|-----------|--------------|
| PKCE support | ✅ | ✅ |
| Dynamic client registration | ✅ (RFC 7591) | ❌ Not built-in |
| Token revocation | ✅ (RFC 7009) | ❌ Not built-in |
| OAuth discovery endpoints | ✅ `/.well-known/oauth-*` | ❌ Not built-in |
| Provider token mapping | ✅ RS → Provider | ❌ Not built-in |

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