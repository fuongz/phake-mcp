# HTTP Endpoints

## MCP Endpoints

### `GET /mcp`

SSE stream initialization for MCP protocol.

### `POST /mcp`

JSON-RPC message handling.

### `DELETE /mcp`

Session termination.

### `GET /health`

Health check endpoint.

## OAuth Endpoints

### `GET /.well-known/oauth-authorization-server`

OAuth discovery endpoint - returns OAuth authorization server metadata.

### `GET /.well-known/oauth-protected-resource`

Protected resource metadata endpoint.

### `GET /authorize`

Authorization request handler - initiates OAuth flow.

Query parameters:
- `client_id` - OAuth client ID
- `redirect_uri` - Where to redirect after authorization
- `response_type` - Expected: `code`
- `scope` - Space-separated OAuth scopes
- `state` - CSRF protection token
- `code_challenge` - PKCE challenge
- `code_challenge_method` - PKCE method (S256)
- `sid` - Session ID (optional)

### `POST /token`

Token exchange endpoint - exchanges authorization code for tokens.

Form parameters:
- `grant_type` - `authorization_code` or `refresh_token`
- `code` - Authorization code (for `authorization_code` grant)
- `code_verifier` - PKCE verifier (for `authorization_code` grant)
- `refresh_token` - Refresh token (for `refresh_token` grant)
- `client_id` - OAuth client ID
- `client_secret` - OAuth client secret

### `GET /oauth/callback`

OAuth callback handler - processes provider callback and redirects to client.

### `GET /oauth/provider-callback`

Provider callback handler - exchanges provider code for tokens.

### `POST /revoke`

Token revocation endpoint.

Form parameters:
- `token` - Token to revoke
- `token_type_hint` - `access_token` or `refresh_token`

### `POST /register`

Dynamic client registration endpoint (RFC 7591).

Request body (JSON):
```json
{
  "client_name": "My MCP Server",
  "redirect_uris": ["https://my-server.com/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "client_secret_post"
}
```

## Endpoint Summary

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/mcp` | SSE stream initialization |
| `POST` | `/mcp` | JSON-RPC message handling |
| `DELETE` | `/mcp` | Session termination |
| `GET` | `/health` | Health check |
| `GET` | `/.well-known/oauth-authorization-server` | OAuth discovery |
| `GET` | `/.well-known/oauth-protected-resource` | Protected resource metadata |
| `GET` | `/authorize` | Authorization request |
| `POST` | `/token` | Token exchange |
| `GET` | `/oauth/callback` | OAuth callback |
| `GET` | `/oauth/provider-callback` | Provider callback |
| `POST` | `/revoke` | Token revocation |
| `POST` | `/register` | Dynamic client registration |
