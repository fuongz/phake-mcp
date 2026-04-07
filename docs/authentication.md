# Authentication Strategies

This document describes the supported authentication strategies in @phake/mcp.

## Overview

Set `AUTH_STRATEGY` in your environment to choose how clients authenticate:

| Strategy | Description | Required env vars |
|----------|-------------|-------------------|
| `oauth` | Full OAuth 2.1 PKCE flow with RS token -> provider token mapping | See [OAuth Configuration](#oauth-configuration) |
| `google` | Same as OAuth with Google preset endpoints | See [Google Configuration](#google-configuration) |
| `github` | Same as OAuth with GitHub preset endpoints | See [GitHub Configuration](#github-configuration) |
| `bearer` | Static Bearer token | `BEARER_TOKEN` |
| `api_key` | Static API key via header | `API_KEY`, `API_KEY_HEADER` (optional) |
| `custom` | Arbitrary custom headers | `CUSTOM_HEADERS` |
| `none` | No authentication | - |

## OAuth Configuration

For the generic `oauth` strategy, you need both OAuth client credentials AND provider credentials:

### OAuth Client (RS credentials)

These credentials identify your MCP server as a client to OAuth clients:

| Variable | Required | Description |
|----------|----------|-------------|
| `OAUTH_CLIENT_ID` | Yes | Your server's OAuth client ID |
| `OAUTH_CLIENT_SECRET` | Yes | Your server's OAuth client secret |

### Provider Configuration

These credentials map RS tokens to upstream provider tokens:

| Variable | Required | Description |
|----------|----------|-------------|
| `PROVIDER_CLIENT_ID` | No* | Upstream provider's client ID (or use `OAUTH_CLIENT_ID`) |
| `PROVIDER_CLIENT_SECRET` | No* | Upstream provider's client secret (or use `OAUTH_CLIENT_SECRET`) |
| `PROVIDER_ACCOUNTS_URL` | Yes | Upstream provider's accounts URL (issuer) |
| `PROVIDER_API_URL` | No | Upstream provider's API URL |

> * `PROVIDER_CLIENT_ID`/`PROVIDER_CLIENT_SECRET` are optional — if not set, `OAUTH_CLIENT_ID`/`OAUTH_CLIENT_SECRET` will be used instead.

### OAuth Flow Options

| Variable | Required | Description |
|----------|----------|-------------|
| `OAUTH_SCOPES` | Yes | Space-separated OAuth scopes |
| `OAUTH_REDIRECT_URI` | Yes | Redirect URI after authorization |
| `OAUTH_REDIRECT_ALLOWLIST` | No | Comma-separated allowed redirect URIs |
| `OAUTH_REDIRECT_ALLOW_ALL` | No | Allow any redirect URI (dangerous in prod) |
| `OAUTH_EXTRA_AUTH_PARAMS` | No | Extra params for auth URL (e.g., `access_type=offline&prompt=consent`) |
| `OAUTH_AUTHORIZATION_URL` | No | Override authorization endpoint |
| `OAUTH_TOKEN_URL` | No | Override token endpoint |

### OAuth Callback URLs

The OAuth flow involves two callback endpoints:

| Endpoint | Purpose |
|----------|---------|
| `/oauth/provider-callback` | Provider redirects here after user authorizes (server exchanges code for tokens) |
| `/oauth/callback` | Success page shown to user after authentication completes |

When creating an OAuth app with Google/GitHub, use `/oauth/provider-callback` as the **Authorization callback URL**.

The flow works as follows:
```
1. User initiates auth at /authorize
2. Redirect to provider (Google/GitHub) with redirect_uri=/oauth/provider-callback
3. Provider redirects back to /oauth/provider-callback (server exchanges code for tokens)
4. Server redirects to /oauth/callback with RS code (success page)
```

## Google Configuration

The `google` strategy simplifies Google OAuth by providing preset endpoints:

### Creating a Google OAuth Client

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Select or create a project
3. Navigate to **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **OAuth client ID**
5. For Application type, select **Web application**
6. Configure the authorized redirect URI:
   - For production: `https://your-domain.com/oauth/provider-callback`
   - For local development: `http://localhost:3000/oauth/provider-callback`
7. Copy the **Client ID** and **Client Secret**

### Environment Setup

```bash
AUTH_STRATEGY=google
OAUTH_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
OAUTH_CLIENT_SECRET=GOCSPX-your-secret
OAUTH_SCOPES=openid email profile
OAUTH_REDIRECT_URI=https://your-server.com/oauth/provider-callback
```

### Preset Values

| Setting | Default |
|---------|---------|
| Accounts URL | `https://accounts.google.com` |
| Authorization URL | `https://accounts.google.com/o/oauth2/v2/auth` |
| Token URL | `https://oauth2.googleapis.com/token` |
| Default scopes | `openid email profile` |

You can override any preset with explicit `OAUTH_*` values.

### Example: Google Sheets + Drive

```bash
AUTH_STRATEGY=google
OAUTH_CLIENT_ID=123456789-abc.apps.googleusercontent.com
OAUTH_CLIENT_SECRET=GOCSPX-your-secret
OAUTH_SCOPES=openid email profile
OAUTH_REDIRECT_URI=https://my-mcp.example.com/oauth/provider-callback
AUTH_ALLOW_DIRECT_BEARER=true
```

## GitHub Configuration

The `github` strategy provides preset endpoints for GitHub OAuth:

### Creating a GitHub OAuth App

1. Go to your GitHub account **Settings** > **Developer settings**
2. Select **OAuth Apps** > **New OAuth App**
3. Fill in the application details:
   - **Application name**: Choose a descriptive name (e.g., "My MCP Server")
   - **Homepage URL**: Your server's homepage URL (e.g., `https://my-mcp.example.com`)
   - **Authorization callback URL**: 
     - For production: `https://your-domain.com/oauth/provider-callback`
     - For local development: `http://localhost:3000/oauth/provider-callback`
4. Click **Register application**
5. On the next page, click **Generate a new client secret**
6. Copy the **Client ID** and **Client Secret**

### Environment Setup

```bash
AUTH_STRATEGY=github
OAUTH_CLIENT_ID=your-github-client-id
OAUTH_CLIENT_SECRET=your-github-client-secret
OAUTH_SCOPES=read:user,repo
OAUTH_REDIRECT_URI=https://your-server.com/oauth/provider-callback
```

### Preset Values

| Setting | Default |
|---------|---------|
| Accounts URL | `https://github.com` |
| Authorization URL | `https://github.com/login/oauth/authorize` |
| Token URL | `https://github.com/login/oauth/access_token` |
| Default scopes | `read:user` |

### Available Scopes

GitHub OAuth scopes you may need:

| Scope | Description |
|-------|-------------|
| `read:user` | Read user profile information |
| `user:email` | Read user email addresses |
| `read:org` | Read organization membership |
| `repo` | Full control of private and public repositories |
| `repo:status` | Commit status access |
| `workflow` | Update GitHub Actions workflow files |

### Example: GitHub API Access

```bash
AUTH_STRATEGY=github
OAUTH_CLIENT_ID=Iv1.xxxxxxxx
OAUTH_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OAUTH_SCOPES=read:user,repo
OAUTH_REDIRECT_URI=https://my-mcp.example.com/oauth/provider-callback
```

## Bearer Token

Simple static bearer token authentication:

```bash
AUTH_STRATEGY=bearer
BEARER_TOKEN=your-static-token
```

## API Key

Static API key passed in a custom header:

```bash
AUTH_STRATEGY=api_key
API_KEY=your-api-key
API_KEY_HEADER=x-api-key  # optional, default: x-api-key
```

## Custom Headers

Arbitrary headers for authentication:

```bash
AUTH_STRATEGY=custom
CUSTOM_HEADERS=X-Client-Id:abc123,X-Custom-Auth:secret
```

## Auth Context in Handlers

When using authenticated tools, access auth via the context object:

```typescript
const tool = defineTool({
  name: "my_tool",
  requiresAuth: true,
  handler: async (args, context) => {
    // context.resolvedHeaders - ready-to-use headers for fetch
    // context.providerToken - access token (string)
    // context.provider - full provider info (OAuth only)
    // context.authStrategy - current strategy name
  },
});
```

### Context Properties

| Property | Type | Description |
|----------|------|-------------|
| `sessionId` | string | Current MCP session ID |
| `providerToken` | string \| undefined | Access token for external API calls |
| `resolvedHeaders` | Record<string, string> | Ready-to-use auth headers |
| `authStrategy` | AuthStrategy | Active auth strategy |
| `provider` | ProviderInfo \| undefined | Full provider token info (OAuth only) |
| `signal` | AbortSignal | Cancellation support |
| `bindings` | TEnv \| undefined | Cloudflare worker bindings (see [Cloudflare Bindings](#cloudflare-bindings)) |

## Getting User Info (OAuth)

When using OAuth authentication, you may need to fetch the user's profile information (email, name, etc.) from the provider. @phake/mcp provides utilities for this:

### Using getUser Helper

```typescript
import { getUser, USERINFO_ENDPOINTS } from "@phake/mcp";

const tool = defineTool({
  name: "get_profile",
  requiresAuth: true,
  handler: async (args, context) => {
    const accessToken = context.providerToken;
    if (!accessToken) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }

    // Fetch user info from provider
    const userinfo = await getUser(accessToken, USERINFO_ENDPOINTS.google);
    
    if (!userinfo) {
      return { content: [{ type: "text", text: "Failed to fetch user info" }], isError: true };
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          email: userinfo.email,
          name: userinfo.name,
          id: userinfo.id,
        })
      }]
    };
  },
});
```

### Available Endpoints

```typescript
import { USERINFO_ENDPOINTS } from "@phake/mcp";

USERINFO_ENDPOINTS.google  // "https://www.googleapis.com/oauth2/v2/userinfo"
USERINFO_ENDPOINTS.github  // "https://api.github.com/user"
```

### ProviderInfo Structure

When using OAuth, the `context.provider` object contains:

```typescript
interface ProviderInfo {
  accessToken: string;        // Current access token
  refreshToken?: string;     // Refresh token (if available)
  expiresAt?: number;        // Token expiration timestamp
  scopes?: string[];         // Granted scopes
  idTokenClaims?: Record<string, unknown>;  // ID token claims (if available)
}
```

> **Note:** To get `idTokenClaims`, ensure your `OAUTH_SCOPES` includes `openid` or `email`. For Google, use `OAUTH_SCOPES=openid email profile`.

## Cloudflare Bindings

When running @phake/mcp in Cloudflare Workers, you can access Cloudflare bindings (AI, Vectorize, D1, R2, KV, etc.) in your tool handlers.

### Setup

Pass your worker `Env` type to `createMCPServer`:

```typescript
import { createMCPServer, defineTool, type ToolContext } from "@phake/mcp";

interface Env extends Cloudflare.Env {
  AI: unknown;
  VECTORIZE: unknown;
  MY_BUCKET: unknown;
}

const server = createMCPServer<Env>({
  tools: [myTool],
});

export default { fetch: server.fetch };
```

### Accessing Bindings in Tools

```typescript
const myTool = defineTool({
  name: "search_vectors",
  inputSchema: z.object({ query: z.string() }),
  handler: async (args, context: ToolContext<Env>) => {
    // Type-safe access to bindings
    const ai = context.bindings?.AI;
    const vectorize = context.bindings?.VECTORIZE;
    const bucket = context.bindings?.MY_BUCKET;

    return {
      content: [{
        type: "text",
        text: `AI: ${!!ai}, Vectorize: ${!!vectorize}, Bucket: ${!!bucket}`
      }]
    };
  },
});
```

### Bindings Available

The following Cloudflare bindings are available through `context.bindings`:

- **AI** - Cloudflare AI binding (embeddings, chat, etc.)
- **VECTORIZE** - Cloudflare Vectorize index
- **D1** - Cloudflare D1 database
- **R2** - Cloudflare R2 object storage
- **KV** - Cloudflare KV namespace
- Any custom bindings defined in your `wrangler.toml`
