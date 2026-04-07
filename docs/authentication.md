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
| `PROVIDER_CLIENT_ID` | Yes | Upstream provider's client ID |
| `PROVIDER_CLIENT_SECRET` | Yes | Upstream provider's client secret |
| `PROVIDER_ACCOUNTS_URL` | Yes | Upstream provider's accounts URL (issuer) |
| `PROVIDER_API_URL` | No | Upstream provider's API URL |

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

## Google Configuration

The `google` strategy simplifies Google OAuth by providing preset endpoints:

### Creating a Google OAuth Client

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Select or create a project
3. Navigate to **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **OAuth client ID**
5. For Application type, select **Web application**
6. Configure the authorized redirect URI:
   - For production: `https://your-domain.com/oauth/callback`
   - For local development: `http://localhost:3000/oauth/callback`
7. Copy the **Client ID** and **Client Secret**

### Environment Setup

```bash
AUTH_STRATEGY=google
OAUTH_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
OAUTH_CLIENT_SECRET=GOCSPX-your-secret
OAUTH_SCOPES=https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly
OAUTH_REDIRECT_URI=https://your-server.com/oauth/callback
```

### Preset Values

| Setting | Default |
|---------|---------|
| Accounts URL | `https://accounts.google.com` |
| Authorization URL | `https://accounts.google.com/o/oauth2/v2/auth` |
| Token URL | `https://oauth2.googleapis.com/token` |
| Default scopes | `https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly` |

You can override any preset with explicit `OAUTH_*` values.

### Example: Google Sheets + Drive

```bash
AUTH_STRATEGY=google
OAUTH_CLIENT_ID=123456789-abc.apps.googleusercontent.com
OAUTH_CLIENT_SECRET=GOCSPX-your-secret
OAUTH_SCOPES=https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly
OAUTH_REDIRECT_URI=https://my-mcp.example.com/oauth/callback
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
     - For production: `https://your-domain.com/oauth/callback`
     - For local development: `http://localhost:3000/oauth/callback`
4. Click **Register application**
5. On the next page, click **Generate a new client secret**
6. Copy the **Client ID** and **Client Secret**

### Environment Setup

```bash
AUTH_STRATEGY=github
OAUTH_CLIENT_ID=your-github-client-id
OAUTH_CLIENT_SECRET=your-github-client-secret
OAUTH_SCOPES=read:user,repo
OAUTH_REDIRECT_URI=https://your-server.com/oauth/callback
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
OAUTH_REDIRECT_URI=https://my-mcp.example.com/oauth/callback
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
