# Configuration Reference

All configuration is read from environment variables / Wrangler bindings.

## Required Variables

| Variable | Description |
|----------|-------------|
| `TOKENS` | Cloudflare KV namespace binding for token/session storage |
| `RS_TOKENS_ENC_KEY` | Base64url-encoded 32-byte AES-256-GCM encryption key |

## Server Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `127.0.0.1` | Server host |
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | Environment: `development`, `production`, `test` |
| `BASE_URL` | - | Base URL override (for reverse proxies) |
| `LOG_LEVEL` | `info` | Log level: `debug`, `info`, `warning`, `error` |
| `RPS_LIMIT` | `10` | Requests per second limit |
| `CONCURRENCY_LIMIT` | `5` | Concurrent request limit |

## MCP Server Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_TITLE` | `MCP Server Template` | Server title |
| `MCP_INSTRUCTIONS` | - | Server instructions for LLM |
| `MCP_VERSION` | `0.1.0` | Server version |
| `MCP_PROTOCOL_VERSION` | `2025-06-18` | MCP protocol version |
| `MCP_ACCEPT_HEADERS` | - | Comma-separated list of accepted headers |

## Authentication

See [Authentication Guide](./authentication.md) for detailed auth configuration.

| Variable | Description |
|----------|-------------|
| `AUTH_STRATEGY` | Auth strategy: `oauth`, `google`, `bearer`, `api_key`, `custom`, `none` |
| `AUTH_ENABLED` | Enable authentication (default: inferred from strategy) |
| `AUTH_REQUIRE_RS` | Require RS token for access |
| `AUTH_ALLOW_DIRECT_BEARER` | Allow direct bearer tokens without RS mapping |
| `AUTH_RESOURCE_URI` | Resource URI for OAuth discovery |
| `AUTH_DISCOVERY_URL` | OAuth discovery URL override |

### OAuth / Google

| Variable | Required | Description |
|----------|----------|-------------|
| `OAUTH_CLIENT_ID` | Yes* | OAuth client ID |
| `OAUTH_CLIENT_SECRET` | Yes* | OAuth client secret |
| `OAUTH_SCOPES` | Yes | Space-separated OAuth scopes |
| `OAUTH_REDIRECT_URI` | Yes | Redirect URI after authorization |
| `OAUTH_REDIRECT_ALLOWLIST` | No | Comma-separated allowed redirect URIs |
| `OAUTH_REDIRECT_ALLOW_ALL` | No | Allow any redirect URI (dangerous) |
| `OAUTH_EXTRA_AUTH_PARAMS` | No | Extra params for auth URL |
| `OAUTH_AUTHORIZATION_URL` | No | Override authorization endpoint |
| `OAUTH_TOKEN_URL` | No | Override token endpoint |
| `OAUTH_REVOCATION_URL` | No | Token revocation endpoint |

*Required for `google` strategy; for `oauth` also requires `PROVIDER_*` variables.

### Provider (OAuth only)

| Variable | Required | Description |
|----------|----------|-------------|
| `PROVIDER_CLIENT_ID` | OAuth | Upstream provider client ID |
| `PROVIDER_CLIENT_SECRET` | OAuth | Upstream provider client secret |
| `PROVIDER_ACCOUNTS_URL` | OAuth | Provider accounts URL (issuer) |
| `PROVIDER_API_URL` | No | Provider API URL |

### Static Auth

| Variable | For Strategy | Description |
|----------|--------------|-------------|
| `BEARER_TOKEN` | `bearer` | Static Bearer token |
| `API_KEY` | `api_key` | Static API key |
| `API_KEY_HEADER` | `api_key` | Header name (default: `x-api-key`) |
| `CUSTOM_HEADERS` | `custom` | Headers in format `Header1:value1,Header2:value2` |

## CIMD (Client Metadata)

SEP-991 Client ID Metadata Documents support:

| Variable | Default | Description |
|----------|---------|-------------|
| `CIMD_ENABLED` | `true` | Enable CIMD support |
| `CIMD_FETCH_TIMEOUT_MS` | `5000` | Fetch timeout in milliseconds |
| `CIMD_MAX_RESPONSE_BYTES` | `65536` | Max response size |
| `CIMD_ALLOWED_DOMAINS` | - | Comma-separated allowed domains for client IDs |

## Storage

| Variable | Description |
|----------|-------------|
| `RS_TOKENS_FILE` | File path for file-based token store (experimental) |
| `RS_TOKENS_ENC_KEY` | Encryption key for token storage |

## Generating Encryption Key

Tokens at rest are encrypted with AES-256-GCM. Generate a 32-byte key:

```bash
# OpenSSL
openssl rand -base64 32 | tr '+/' '-_' | tr -d '='

# Node.js
node -e "const {randomBytes}=require('crypto'); console.log(randomBytes(32).toString('base64url'))"
```

## Local Development

For local development, create a `.dev.vars` file:

```ini
RS_TOKENS_ENC_KEY=your-generated-key
AUTH_STRATEGY=bearer
BEARER_TOKEN=dev-token
```