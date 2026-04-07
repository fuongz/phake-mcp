# Storage Backends

@phake/mcp supports multiple storage backends for tokens, sessions, and transaction state.

## Token Stores

### `KvTokenStore`

Cloudflare KV-based token storage with memory fallback.

- **Use case**: Tokens, transactions, authorization codes
- **Features**: Cloudflare KV + memory fallback, AES-256-GCM encryption
- **Runtime**: Cloudflare Workers

```typescript
import { KvTokenStore } from "@phake/mcp";

const store = new KvTokenStore({
  binding: env.TOKENS,  // Cloudflare KV namespace
  encKey: env.RS_TOKENS_ENC_KEY,  // AES-256-GCM key
});
```

### `MemoryTokenStore`

In-memory token storage.

- **Use case**: Development, single-instance deployments
- **Features**: TTL expiration, 10K token limit, LRU eviction
- **Runtime**: Any

```typescript
import { MemoryTokenStore } from "@phake/mcp";

const store = new MemoryTokenStore();
```

### `FileTokenStore`

File-based token storage (experimental).

- **Use case**: Simple deployments without KV
- **Features**: File persistence, AES-256-GCM encryption
- **Runtime**: Node.js, Bun

```typescript
import { FileTokenStore } from "@phake/mcp";

const store = new FileTokenStore({
  path: "./tokens.json",
  encKey: process.env.RS_TOKENS_ENC_KEY,
});
```

## Session Stores

### `KvSessionStore`

Cloudflare KV-based session storage with memory fallback.

- **Use case**: Session management
- **Features**: Cloudflare KV + memory fallback, encryption, API-key indexing
- **Runtime**: Cloudflare Workers

```typescript
import { KvSessionStore } from "@phake/mcp";

const store = new KvSessionStore({
  binding: env.TOKENS,
  encKey: env.RS_TOKENS_ENC_KEY,
});
```

### `MemorySessionStore`

In-memory session storage.

- **Use case**: Development, single-instance deployments
- **Features**: TTL (24h), 10K limit, per-API-key limit (5)
- **Runtime**: Any

```typescript
import { MemorySessionStore } from "@phake/mcp";

const store = new MemorySessionStore();
```

### `SqliteSessionStore`

SQLite-based session storage (experimental).

- **Use case**: Persistent local development
- **Features**: SQLite + Drizzle ORM, WAL mode
- **Runtime**: Node.js, Bun

```typescript
import { SqliteSessionStore } from "@phake/mcp";

const store = new SqliteSessionStore({
  path: "./sessions.db",
});
```

## Storage Summary

| Backend | Use case | Features | Runtime |
|---------|----------|----------|---------|
| `KvTokenStore` | Tokens, transactions, codes | KV + memory, AES-256-GCM | Workers |
| `MemoryTokenStore` | Development | TTL, 10K limit, LRU | Any |
| `FileTokenStore` | Simple deployments | File persistence, encryption | Node/Bun |
| `KvSessionStore` | Sessions | KV + memory, encryption | Workers |
| `MemorySessionStore` | Development | TTL (24h), 10K limit | Any |
| `SqliteSessionStore` | Persistent dev | SQLite, Drizzle, WAL | Node/Bun |

## Encryption

Token stores use AES-256-GCM encryption at rest. Generate an encryption key:

```bash
# OpenSSL
openssl rand -base64 32 | tr '+/' '-_' | tr -d '='

# Node.js
node -e "const {randomBytes}=require('crypto'); console.log(randomBytes(32).toString('base64url'))"
```

## Storage Configuration

Set the encryption key via environment variable:

```bash
RS_TOKENS_ENC_KEY=<your-generated-key>
```

For file-based storage, specify the file path:

```bash
RS_TOKENS_FILE=./tokens.json
```
