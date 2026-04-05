# @phake/mcp

A TypeScript library for building [MCP (Model Context Protocol)](https://modelcontextprotocol.io) servers - works on both Cloudflare Workers and Node.js.

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

- [Bun](https://bun.sh) 1.x or Node.js 20+
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) CLI (for Cloudflare Workers deployments)
- A Cloudflare account with Workers and KV access (for Worker deployments)

## Installation

```bash
bun add @phake/mcp
# or
npm install @phake/mcp
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

**Tool definition fields:**

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

**Handler return values:**

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
    return await response.json();
  },
});
```

**Available context properties:**

| Property | Description |
|----------|-------------|
| `sessionId` | Current MCP session ID |
| `providerToken` | Access token for external API calls |
| `resolvedHeaders` | Ready-to-use auth headers for `fetch` |
| `authStrategy` | Active auth strategy (`oauth`, `bearer`, `api_key`, `custom`, `none`) |
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

### `defineTool(def)`

Type-safe tool factory. See [Defining Tools](#defining-tools) for the full field reference.

### `withStructured(full, structured)`

Helper to split a large response object (for LLM context) from a compact structured output (for `outputSchema`):

```typescript
import { withStructured } from "@phake/mcp";

handler: async (args) =>
  withStructured(
    { ...fullScanData, debug: "..." }, // full - goes into content[].text
    { ok: true, count: 5 },            // structured — matches outputSchema
  ),
```

### `toolFail(defaults)`

Creates a typed error factory with preset default fields:

```typescript
import { toolFail } from "@phake/mcp";

const fail = toolFail({ ok: false, items: null });
return fail("spreadsheet_id is required");
// => { ok: false, items: null, error: "spreadsheet_id is required" }
```

### Built-in Tools

| Tool | Input | Output | Description |
|------|-------|--------|-------------|
| `echo` | `{ message, uppercase? }` | `{ echoed, length }` | Echoes back a message, optionally uppercased |
| `health` | `{ verbose? }` | `{ status, timestamp, runtime, uptime? }` | Reports server health and runtime info |

### Package Exports

| Export | Path | Description |
|--------|------|-------------|
| Core | `@phake/mcp` | `defineTool`, `createMCPServer`, helpers |
| Worker runtime | `@phake/mcp/runtime/worker` | Cloudflare Workers adapter internals |
| Node runtime | `@phake/mcp/runtime/node` | Node.js adapter internals (**experimental**) |

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
| `API_KEY_HEADER` | api_key only | Header name for API key (default: `x-api-key`) |
| `BEARER_TOKEN` | bearer only | Static Bearer token value |
| `CUSTOM_HEADERS` | custom only | JSON-encoded headers object |
| `BASE_URL` | No | Base URL override (for reverse proxies) |
| `LOG_LEVEL` | No | `debug` \| `info` \| `warning` \| `error` (default: `info`) |

## Contributing

```bash
# Install dependencies
bun install

# Run tests
bun test

# Type check
bun run typecheck

# Build
bun run build
```

**Project structure:**

```
src/
├── adapters/
│   ├── http-node/      # Node.js (Hono) adapter
│   └── http-worker/    # Cloudflare Workers adapter
├── shared/
│   ├── auth/           # Authentication strategies
│   ├── config/         # Environment configuration
│   ├── crypto/         # AES-256-GCM utilities
│   ├── oauth/          # OAuth 2.1 (PKCE, CIMD, discovery)
│   ├── tools/          # Tool definitions, registry, execution
│   ├── types/          # Shared TypeScript types
│   └── utils/          # Base64, pagination, logging helpers
├── __tests__/          # Unit tests (Bun test runner)
├── mcp-server.ts       # Server factory
└── index.ts            # Package entry point
```

Inspired by [streamable-mcp-server-template](https://github.com/iceener/streamable-mcp-server-template).

## License

[MIT](LICENSE)
