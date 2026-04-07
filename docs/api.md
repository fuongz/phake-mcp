# API Reference

## `createMCPServer(options)`

Creates an MCP server instance.

```typescript
import { createMCPServer } from "@phake/mcp";

const server = createMCPServer({
  adapter: "worker",
  tools: [greetTool, profileTool],
});

export default server;
```

### Options

| Option | Type | Description |
|--------|------|-------------|
| `adapter` | `"worker"` | Runtime adapter |
| `tools` | `SharedToolDefinition[]` | Tools to register |

## `defineTool(def)`

Type-safe tool factory. See [Getting Started](./getting-started.md) for the full field reference.

```typescript
import { defineTool } from "@phake/mcp";
import { z } from "zod";

const tool = defineTool({
  name: "my_tool",
  description: "Does something useful",
  inputSchema: z.object({ ... }),
  handler: async (args, context) => { ... },
});
```

## `toolFail(defaults)`

Creates a typed error factory with preset default fields:

```typescript
import { toolFail } from "@phake/mcp";

const fail = toolFail({ ok: false, items: null });
return fail("spreadsheet_id is required");
// => { ok: false, items: null, error: "spreadsheet_id is required" }
```

## `assertProviderToken(context)`

Asserts that the context has a provider token. Throws if missing.

```typescript
import { assertProviderToken } from "@phake/mcp";

handler: async (_args, context) => {
  assertProviderToken(context);
  // context.providerToken is now typed as string
  const token = context.providerToken;
  // ...
}
```

## Built-in Tools

### `echo`

Echoes back a message, optionally uppercased.

| Input | Output |
|-------|--------|
| `{ message: string, uppercase?: boolean }` | `{ echoed: string, length: number }` |

### `health`

Reports server health and runtime info.

| Input | Output |
|-------|--------|
| `{ verbose?: boolean }` | `{ status: string, timestamp: number, runtime: string, uptime?: number }` |

## Package Exports

| Export | Path | Description |
|--------|------|-------------|
| Core | `@phake/mcp` | `defineTool`, `createMCPServer`, helpers |
| Worker runtime | `@phake/mcp/runtime/worker` | Cloudflare Workers adapter internals |
| Node runtime | `@phake/mcp/runtime/node` | Node.js adapter internals (**experimental**) |

## Type Reference

### `SharedToolDefinition`

Base tool definition interface:

```typescript
interface SharedToolDefinition {
  name: string;
  description: string;
  inputSchema: ZodObject<any>;
  outputSchema?: ZodRawShape | ZodObject<any>;
  handler: ToolHandler;
  requiresAuth?: boolean;
  title?: string;
  annotations?: ToolAnnotations;
  meta?: { version?: string; last_update?: number };
}
```

### `ToolHandler`

```typescript
type ToolHandler = (
  args: unknown,
  context: ToolContext
) => Promise<ToolResult | Record<string, unknown>>;
```

### `ToolContext`

Context passed to tool handlers:

```typescript
interface ToolContext {
  sessionId: string;
  providerToken?: string;
  resolvedHeaders: Record<string, string>;
  authStrategy: AuthStrategy;
  provider?: ProviderInfo;
  signal: AbortSignal;
}
```

### `AuthStrategy`

Supported authentication strategies:

```typescript
type AuthStrategy =
  | "oauth"
  | "google"
  | "github"
  | "bearer"
  | "api_key"
  | "custom"
  | "none";
```
