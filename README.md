# @phake/mcp

A TypeScript library for building MCP (Model Context Protocol) servers, designed to run on Cloudflare Workers and Node.js.

[![npm](https://img.shields.io/npm/v/@phake/mcp?style=flat-square)](https://www.npmjs.com/package/@phake/mcp)

## Features

- **Multi-runtime support** - Deploy to Cloudflare Workers (itty-router) or Node.js (Hono)
- **OAuth 2.0 authentication** - Full PKCE flow with dynamic token resolution and proactive refresh
- **5 auth strategies** - `oauth`, `bearer`, `api_key`, `custom`, `none`
- **Tool registration** - Define and register MCP tools with Zod input/output schemas
- **Session & token management** - Persistent storage with LRU eviction and TTL
- **Multiple storage backends** - Cloudflare KV, SQLite, file-based, and in-memory
- **CORS support** - Configurable CORS headers
- **Type-safe** - Full TypeScript support with Zod validation

## Installation

```bash
bun add @phake/mcp
```

## Quick Start

### Cloudflare Workers

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

### Node.js

```typescript
import { createHttpApp, createAuthApp } from "@phake/mcp/runtime/node";

const { app, sessionStore } = createHttpApp({
  tools: [
    // your tool definitions
  ],
});

const authApp = createAuthApp({ sessionStore });
```

## API

### `createMCPServer(options)`

Creates an MCP server instance.

| Option | Type | Description |
|--------|------|-------------|
| `adapter` | `"worker" \| "node"` | Runtime adapter |
| `tools` | `SharedToolDefinition[]` | Array of tool definitions to register |

### Exports

| Module | Path |
|--------|------|
| Core | `@phake/mcp` |
| Node runtime | `@phake/mcp/runtime/node` |
| Worker runtime | `@phake/mcp/runtime/worker` |

## Authentication Strategies

| Strategy | Description | Config Env Vars |
|----------|-------------|-----------------|
| `oauth` | Full OAuth 2.1 PKCE flow with RS token -> provider token mapping | `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`, `OAUTH_SCOPES`, `OAUTH_REDIRECT_URI`, `PROVIDER_CLIENT_ID`, `PROVIDER_CLIENT_SECRET`, `PROVIDER_ACCOUNTS_URL` |
| `bearer` | Static Bearer token | `BEARER_TOKEN` |
| `api_key` | Static API key in custom header (default: `x-api-key`) | `API_KEY`, `API_KEY_HEADER` |
| `custom` | Arbitrary custom headers | `CUSTOM_HEADERS` |
| `none` | No authentication required | - |

## Storage Backends

| Backend | Stores | Key Features |
|---------|--------|--------------|
| `MemoryTokenStore` | Tokens, transactions, codes | TTL expiration, size limits (10K tokens), LRU eviction |
| `MemorySessionStore` | Sessions | TTL (24h), size limit (10K), per-API-key limits (5) |
| `KvTokenStore` | Tokens, transactions, codes | Cloudflare KV + memory fallback, AES-256-GCM encryption |
| `KvSessionStore` | Sessions | Cloudflare KV + memory fallback, encryption, API-key indexing |
| `FileTokenStore` | RS token mappings | JSON file persistence, AES-256-GCM encryption, secure permissions (0600) |
| `SqliteSessionStore` | Sessions | SQLite via better-sqlite3 + Drizzle ORM, WAL mode, atomic transactions |

## Creating Tools

Use `defineTool` to create a type-safe tool definition, then pass it to `tools` when creating the server.

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
  outputSchema: {
    message: z.string().describe("The greeting message"),
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
  },
  handler: async (args, context) => {
    const message = `Hello, ${args.name}!`;
    return {
      content: [{ type: "text", text: message }],
      structuredContent: { message },
    };
  },
});
```

### Authenticated Tools

Set `requiresAuth: true` to have the dispatcher automatically reject calls when no token is present. Use `context.resolvedHeaders` to call external APIs.

```typescript
import { defineTool } from "@phake/mcp";
import { z } from "zod";

const profileTool = defineTool({
  name: "get_profile",
  description: "Fetch the authenticated user's profile",
  inputSchema: z.object({}),
  requiresAuth: true,
  handler: async (_args, context) => {
    const response = await fetch("https://api.example.com/me", {
      headers: context.resolvedHeaders,
    });
    const data = await response.json();
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
    };
  },
});
```

### Registering Tools

```typescript
import { createMCPServer } from "@phake/mcp";

const server = createMCPServer({
  adapter: "worker",
  tools: [greetTool, profileTool],
});
```

### Tool Handler Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Unique tool name |
| `description` | `string` | Yes | Description shown to the LLM |
| `inputSchema` | `ZodObject` | Yes | Zod schema for input validation |
| `outputSchema` | `ZodRawShape` | No | Zod schema for structured output |
| `handler` | `function` | Yes | `(args, context) => Promise<ToolResult>` |
| `requiresAuth` | `boolean` | No | Reject calls without a provider token |
| `title` | `string` | No | Human-readable display title |
| `annotations` | `object` | No | MCP hints (`readOnlyHint`, `destructiveHint`, etc.) |

The `context` object provides:

| Property | Description |
|----------|-------------|
| `sessionId` | Current MCP session ID |
| `providerToken` | Access token for external API calls |
| `resolvedHeaders` | Ready-to-use auth headers for `fetch` |
| `authStrategy` | Active auth strategy |
| `signal` | `AbortSignal` for cancellation |

## Built-in Tools

| Tool | Input | Output | Description |
|------|-------|--------|-------------|
| `echo` | `{ message, uppercase? }` | `{ echoed, length }` | Echoes back a message, optionally uppercased |
| `health` | `{ verbose? }` | `{ status, timestamp, runtime, uptime? }` | Reports server health, uptime, runtime detection |

## Project Structure

```
src/
├── adapters/
│   ├── http-node/           # Node.js adapter (Hono)
│   │   ├── http/            # MCP server app, routes, middleware
│   │   ├── routes.discovery.ts
│   │   ├── routes.oauth.ts
│   │   └── middleware.security.ts
│   └── http-worker/         # Cloudflare Workers adapter (itty-router)
│       ├── index.ts
│       ├── mcp.handler.ts
│       ├── routes.discovery.ts
│       ├── routes.oauth.ts
│       └── security.ts
├── runtime/
│   └── node/
│       ├── capabilities.ts
│       ├── context.ts
│       ├── mcp.ts
│       └── storage/
│           ├── file.ts
│           └── sqlite.ts
├── shared/
│   ├── auth/                # Authentication strategies
│   ├── config/              # Environment configuration (40+ fields)
│   ├── crypto/              # AES-256-GCM utilities
│   ├── http/                # CORS, JSON-RPC responses
│   ├── mcp/                 # Protocol dispatcher, security, server internals
│   ├── oauth/               # Full OAuth 2.0 implementation (PKCE, CIMD, discovery)
│   ├── services/            # HTTP client
│   ├── storage/             # Token/session store interfaces and implementations
│   ├── tools/               # Tool definitions, registry, execution
│   ├── types/               # Shared type definitions
│   └── utils/               # Base64, cancellation, logger, pagination, etc.
├── mcp-server.ts            # Server factory
└── index.ts                 # Main entry point
```

## MCP Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/mcp` | SSE stream initialization |
| `POST` | `/mcp` | JSON-RPC message handling |
| `DELETE` | `/mcp` | Session termination |
| `GET` | `/health` | Health check |

## OAuth Endpoints

| Path | Description |
|------|-------------|
| `/.well-known/oauth-authorization-server` | OAuth discovery |
| `/.well-known/oauth-protected-resource` | Protected resource metadata |
| `/authorize` | Authorization request |
| `/token` | Token exchange |
| `/oauth/callback` | OAuth callback |
| `/oauth/provider-callback` | Provider callback |
| `/revoke` | Token revocation |
| `/register` | Dynamic client registration |

## Scripts

| Command | Description |
|---------|-------------|
| `bun run build` | Build with Bun |
| `bun run typecheck` | Run TypeScript type checking |

## Dependencies

- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `zod` - Schema validation
- `jose` - JWT and JWS/JWE
- `oauth4webapi` - OAuth 2.0 for Web API
- `itty-router` - Lightweight router (Workers)
- `hono` / `@hono/node-server` - Node.js HTTP framework (optional)
- `drizzle-orm` / `better-sqlite3` - Database layer (optional)

## Inspired By

This project was inspired by [streamable-mcp-server-template](https://github.com/iceener/streamable-mcp-server-template).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
