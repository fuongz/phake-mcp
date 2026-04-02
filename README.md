# @phake/mcp

A TypeScript library for building [MCP (Model Context Protocol)](https://modelcontextprotocol.io) servers on Cloudflare Workers.

[![npm](https://img.shields.io/npm/v/@phake/mcp?style=flat-square)](https://www.npmjs.com/package/@phake/mcp)
[![license](https://img.shields.io/npm/l/@phake/mcp?style=flat-square)](LICENSE)

---

- [Requirements](#requirements)
- [Installation](#installation)
- [Getting Started](#getting-started)
- [Usage](#usage)
  - [Defining Tools](#defining-tools)
  - [Authenticated Tools](#authenticated-tools)
  - [Authentication Strategies](#authentication-strategies)
  - [Storage Backends](#storage-backends)
- [API Reference](#api-reference)
- [Endpoints](#endpoints)
- [Configuration](#configuration)
- [Contributing](#contributing)
- [License](#license)

---

## Requirements

- [Bun](https://bun.sh) or Node.js 20+
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) CLI
- A Cloudflare account with Workers and KV access

## Installation

```bash
bun add @phake/mcp
```

## Getting Started

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

## Usage

### Defining Tools

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

**Tool definition fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Unique tool identifier |
| `description` | `string` | Yes | Description shown to the LLM |
| `inputSchema` | `ZodObject` | Yes | Zod schema for input validation |
| `outputSchema` | `ZodRawShape` | No | Zod schema for structured output |
| `handler` | `function` | Yes | `(args, context) => Promise<ToolResult>` |
| `requiresAuth` | `boolean` | No | Reject calls without a provider token |
| `title` | `string` | No | Human-readable display title |
| `annotations` | `object` | No | MCP hints (`readOnlyHint`, `destructiveHint`, etc.) |

### Authenticated Tools

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
    const data = await response.json();
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
    };
  },
});
```

**Available context properties:**

| Property | Description |
|----------|-------------|
| `sessionId` | Current MCP session ID |
| `providerToken` | Access token for external API calls |
| `resolvedHeaders` | Ready-to-use auth headers for `fetch` |
| `authStrategy` | Active auth strategy |
| `signal` | `AbortSignal` for cancellation |

### Authentication Strategies

Set `AUTH_STRATEGY` in your environment (or let it be inferred from which keys are present):

| Strategy | Description | Required env vars |
|----------|-------------|-------------------|
| `oauth` | Full OAuth 2.1 PKCE flow with RS token => provider token mapping | `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`, `OAUTH_SCOPES`, `OAUTH_REDIRECT_URI`, `PROVIDER_CLIENT_ID`, `PROVIDER_CLIENT_SECRET`, `PROVIDER_ACCOUNTS_URL` |
| `bearer` | Static Bearer token | `BEARER_TOKEN` |
| `api_key` | Static API key via header (default: `x-api-key`) | `API_KEY`, `API_KEY_HEADER` |
| `custom` | Arbitrary custom request headers | `CUSTOM_HEADERS` |
| `none` | No authentication | - |

### Storage Backends

| Backend | Use case | Notes |
|---------|----------|-------|
| `KvTokenStore` | Tokens, transactions, codes | Cloudflare KV + memory fallback, AES-256-GCM encryption |
| `KvSessionStore` | Sessions | Cloudflare KV + memory fallback, encryption, API-key indexing |
| `MemoryTokenStore` | Tokens, transactions, codes | TTL expiration, 10K token limit, LRU eviction |
| `MemorySessionStore` | Sessions | TTL (24h), 10K limit, per-API-key limit (5) |
| `FileTokenStore` | RS token mappings | File persistence, AES-256-GCM - **experimental** |
| `SqliteSessionStore` | Sessions | SQLite + Drizzle ORM, WAL mode - **experimental** |

## API Reference

### `createMCPServer(options)`

Creates an MCP server instance.

```typescript
import { createMCPServer } from "@phake/mcp";

const server = createMCPServer({
  adapter: "worker",
  tools: [greetTool, profileTool],
});

export default server;
```

| Option | Type | Description |
|--------|------|-------------|
| `adapter` | `"worker"` | Runtime adapter |
| `tools` | `SharedToolDefinition[]` | Tools to register |

### Built-in Tools

| Tool | Input | Output | Description |
|------|-------|--------|-------------|
| `echo` | `{ message, uppercase? }` | `{ echoed, length }` | Echoes back a message |
| `health` | `{ verbose? }` | `{ status, timestamp, runtime, uptime? }` | Reports server health |

### Package Exports

| Export | Path |
|--------|------|
| Core | `@phake/mcp` |
| Worker runtime | `@phake/mcp/runtime/worker` |

> **Node.js runtime** (`@phake/mcp/runtime/node`) is available but experimental and untested.

## Endpoints

### MCP

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/mcp` | SSE stream initialization |
| `POST` | `/mcp` | JSON-RPC message handling |
| `DELETE` | `/mcp` | Session termination |
| `GET` | `/health` | Health check |

### OAuth

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

## Configuration

All configuration is read from environment variables / Wrangler bindings.

| Variable | Required | Description |
|----------|----------|-------------|
| `TOKENS` | Yes | Cloudflare KV namespace binding for token/session storage |
| `RS_TOKENS_ENC_KEY` | Yes | Base64url-encoded 32-byte AES-256-GCM encryption key |
| `AUTH_STRATEGY` | No | `oauth` \| `bearer` \| `api_key` \| `custom` \| `none` (inferred if unset) |
| `OAUTH_CLIENT_ID` | OAuth only | OAuth client ID |
| `OAUTH_CLIENT_SECRET` | OAuth only | OAuth client secret |
| `OAUTH_SCOPES` | OAuth only | Space-separated OAuth scopes |
| `OAUTH_REDIRECT_URI` | OAuth only | Redirect URI after authorization |
| `API_KEY` | api_key only | Static API key value |
| `BEARER_TOKEN` | bearer only | Static Bearer token value |
| `BASE_URL` | No | Base URL override (for reverse proxies) |
| `LOG_LEVEL` | No | `debug` \| `info` \| `warning` \| `error` (default: `info`) |

## Contributing

```bash
# Install dependencies
bun install

# Build
bun run build

# Type check
bun run typecheck
```

**Project structure:**

```
src/
├── adapters/
│   └── http-worker/    # Cloudflare Workers adapter
├── shared/
│   ├── auth/           # Authentication strategies
│   ├── config/         # Environment configuration
│   ├── crypto/         # AES-256-GCM utilities
│   ├── mcp/            # Protocol dispatcher and server internals
│   ├── oauth/          # OAuth 2.0 (PKCE, CIMD, discovery)
│   ├── storage/        # Token/session store interfaces and implementations
│   └── tools/          # Tool definitions, registry, execution
├── mcp-server.ts       # Server factory
└── index.ts            # Package entry point
```

Inspired by [streamable-mcp-server-template](https://github.com/iceener/streamable-mcp-server-template).

## License

[MIT](LICENSE)
