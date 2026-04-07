# @phake/mcp

A TypeScript library for building [MCP (Model Context Protocol)](https://modelcontextprotocol.io) servers - works on both Cloudflare Workers and Node.js.

[![npm](https://img.shields.io/npm/v/@phake/mcp?style=flat-square)](https://www.npmjs.com/package/@phake/mcp)
[![license](https://img.shields.io/npm/l/@phake/mcp?style=flat-square)](LICENSE)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/fuongz/phake-mcp/publish.yml?style=flat-square)

---

## Why @phake/mcp?

- **Multiple auth strategies**: OAuth 2.1, Google/GitHub presets, Bearer, API Key, Custom headers
- **Encrypted token storage**: AES-256-GCM at rest + proactive refresh
- **Cloudflare Workers native**: KV storage, memory fallback, zero config
- **Production-ready**: CIMD validation, OAuth discovery, DNS rebinding protection
- **Quick scaffold**: `bun create @phake/mcp` to get started

See [Comparison Guide](./docs/comparison.md) for full feature comparison with official SDK.

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

---

## Quick Start (Scaffold)

Scaffold a new MCP server with one command:

```bash
# Interactive (prompts for template)
bun create @phake/mcp

# With options
bun create @phake/mcp my-mcp-app --template cloudflare-workers --install
```

**Available templates:**

| Template | Description |
|----------|-------------|
| `cloudflare-workers` | Cloudflare Workers + Hono (default) |
| `cloudflare-workers-google` | Cloudflare Workers + Google OAuth |
| `node-hono` | Node.js + Bun + Hono |

**Options:**

| Option | Description |
|--------|-------------|
| `-t, --template` | Template name |
| `-i, --install` | Auto install dependencies |
| `-p, --pm` | Package manager: `npm`, `bun`, `yarn`, `pnpm` |

---

## Getting Started

### 1. Create the KV namespace

```bash
wrangler kv namespace create TOKENS
```

### 2. Bind it in your Wrangler config

`wrangler.toml`
```toml
[[kv_namespaces]]
binding = "TOKENS"
id = "<your-kv-namespace-id>"
```

### 3. Generate an encryption key

```bash
openssl rand -base64 32 | tr '+/' '-_' | tr -d '='
```

### 4. Set the encryption key

**Production:**
```bash
wrangler secret put RS_TOKENS_ENC_KEY
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
  tools: [/* your tools */],
});

export default server;
```

For detailed setup, see [Getting Started Guide](./docs/getting-started.md).

---

## Usage

### Defining Tools

```typescript
import { z } from "zod";
import { defineTool } from "@phake/mcp";

const greetTool = defineTool({
  name: "greet",
  description: "Returns a greeting for the given name",
  inputSchema: z.object({
    name: z.string().describe("Name to greet"),
  }),
  outputSchema: z.object({
    message: z.string().describe("The greeting message"),
  }),
  handler: async (args) => {
    return { message: `Hello, ${args.name}!` };
  },
});
```

### Authenticated Tools

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

### Authentication Strategies

| Strategy | Description |
|----------|-------------|
| `oauth` | Full OAuth 2.1 PKCE flow with RS token => provider token mapping |
| `google` | Same as OAuth with Google preset endpoints |
| `github` | Same as OAuth with GitHub preset endpoints |
| `bearer` | Static Bearer token |
| `api_key` | Static API key via header |
| `custom` | Arbitrary custom headers |
| `none` | No authentication |

See [Authentication Guide](./docs/authentication.md) for detailed configuration.

---

## API Reference

### `createMCPServer(options)`

Creates an MCP server instance.

```typescript
const server = createMCPServer({
  adapter: "worker",
  tools: [greetTool, profileTool],
});
```

### `defineTool(def)`

Type-safe tool factory. See [API Reference](./docs/api.md) for the full field reference.

### `toolFail(defaults)`

Creates a typed error factory with preset default fields:

```typescript
const fail = toolFail({ ok: false, items: null });
return fail("spreadsheet_id is required");
// => { ok: false, items: null, error: "spreadsheet_id is required" }
```

### Built-in Tools

| Tool | Input | Output | Description |
|------|-------|--------|-------------|
| `echo` | `{ message, uppercase? }` | `{ echoed, length }` | Echoes back a message |
| `health` | `{ verbose? }` | `{ status, timestamp, runtime, uptime? }` | Reports server health |

### Package Exports

| Export | Path | Description |
|--------|------|-------------|
| Core | `@phake/mcp` | `defineTool`, `createMCPServer`, helpers |
| Worker runtime | `@phake/mcp/runtime/worker` | Cloudflare Workers adapter |
| Node runtime | `@phake/mcp/runtime/node` | Node.js adapter (**experimental**) |

---

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

---

## License

[MIT](LICENSE)
