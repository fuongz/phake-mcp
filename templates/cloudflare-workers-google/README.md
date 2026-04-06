# Cloudflare Workers MCP Server with Google OAuth

An MCP (Model Context Protocol) server template for Cloudflare Workers with Google OAuth 2.1 authentication.

## Quick Start

```bash
# Install dependencies
bun install

# Development
bun run dev

# Deploy to Cloudflare
bun run deploy
```

## Configuration

### 1. Create KV Namespace

```bash
wrangler kv namespace create TOKENS
```

### 2. Update wrangler.jsonc

Add your KV namespace ID:

```jsonc
{
  "kv_namespaces": [
    {
      "binding": "TOKENS",
      "id": "your-kv-namespace-id"
    }
  ]
}
```

### 3. Set Secrets

```bash
# Generate encryption key
openssl rand -base64 32 | tr '+/' '-_' | tr -d '='

# Set secrets
wrangler secret put RS_TOKENS_ENC_KEY
wrangler secret put OAUTH_CLIENT_ID
wrangler secret put OAUTH_CLIENT_SECRET
wrangler secret put PROVIDER_CLIENT_ID
wrangler secret put PROVIDER_CLIENT_SECRET
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TOKENS` | Yes | KV namespace binding |
| `RS_TOKENS_ENC_KEY` | Yes | AES-256-GCM encryption key |
| `OAUTH_CLIENT_ID` | Yes | Your MCP server's OAuth client ID |
| `OAUTH_CLIENT_SECRET` | Yes | Your MCP server's OAuth client secret |
| `PROVIDER_CLIENT_ID` | Yes | Google OAuth client ID |
| `PROVIDER_CLIENT_SECRET` | Yes | Google OAuth client secret |
| `OAUTH_SCOPES` | No | Space-separated scopes (default: `openid email profile`) |

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project or select existing
3. Go to **APIs & Services** > **OAuth consent screen**
   - Select **External**
   - Fill in required fields
   - Add scopes: `openid`, `email`, `profile`
4. Go to **Credentials** > **Create Credentials** > **OAuth client ID**
   - Application type: **Web application**
   - Authorized redirect URI: `https://your-worker.workers.dev/oauth/provider-callback`
5. Copy Client ID and Client Secret

## Your Redirect URI

```
https://your-worker.workers.dev/oauth/provider-callback
```

## Authenticated Tools

The template includes a sample authenticated tool. Use `context.providerToken` to make API calls on behalf of the user:

```typescript
defineTool({
  name: "my_tool",
  description: "My authenticated tool",
  inputSchema: z.object({ ... }),
  handler: async (args, context) => {
    const response = await fetch("https://api.example.com/data", {
      headers: { Authorization: `Bearer ${context.providerToken}` }
    });
    // ...
  },
  requiresAuth: true,  // Require authentication
});
```

## Connect to Claude

See [@phake/mcp README](https://github.com/fuongz/phake-mcp#client-configuration) for client configuration.