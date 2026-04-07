# Client Configuration

How to configure MCP clients for different IDEs and tools.

## MCP Transport Types

MCP transport types vary by client:

| Client | Transport | Config File |
|--------|-----------|-------------|
| Claude Desktop | stdio only | `claude_desktop_config.json` |
| Claude Code | stdio only | `settings.json` in `~/.claude/` |
| Cursor | stdio + SSE | `mcp.json` in project |
| VSCode | stdio + SSE | `.vscode/mcp.json` |
| JetBrains | stdio + HTTP/SSE | IDE settings |

## Claude Desktop

Claude Desktop supports both local (stdio) and remote (HTTP) MCP servers.

### Local (stdio)

```json
{
  "mcpServers": {
    "my-api": {
      "command": "node",
      "args": ["./dist/index.js"],
      "env": {
        "AUTH_STRATEGY": "bearer",
        "BEARER_TOKEN": "your-token"
      }
    }
  }
}
```

### Remote (URL)

```json
{
  "mcpServers": {
    "my-api": {
      "url": "https://your-server.com/mcp",
      "headers": {
        "Authorization": "Bearer your-token"
      }
    }
  }
}
```

**Config file location:**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

## Claude Code

Claude Code uses stdio transport only.

```json
{
  "mcpServers": {
    "my-api": {
      "command": "bun",
      "args": ["run", "./src/index.ts"]
    }
  }
}
```

**Config file location:** `~/.claude/settings.json`

## Cursor

Cursor supports both stdio and SSE transports.

### Stdio

```json
{
  "mcpServers": {
    "my-api": {
      "command": "bun",
      "args": ["run", "./src/index.ts"]
    }
  }
}
```

### SSE (Remote)

```json
{
  "mcpServers": {
    "my-api": {
      "url": "https://your-server.com/mcp",
      "headers": {
        "Authorization": "Bearer your-token"
      }
    }
  }
}
```

**Config file location:** Project root `mcp.json`

## VSCode

VSCode MCP extension supports stdio and SSE transports.

### Stdio

```json
{
  "mcpServers": {
    "my-api": {
      "command": "bun",
      "args": ["run", "./src/index.ts"]
    }
  }
}
```

### SSE (Remote)

```json
{
  "mcpServers": {
    "my-api": {
      "url": "https://your-server.com/mcp",
      "headers": {
        "Authorization": "Bearer your-token"
      }
    }
  }
}
```

**Config file location:** `.vscode/mcp.json` in project root

## Claude Web (Custom Connectors)

Custom connectors allow connecting an MCP server from claude.ai, Cowork, and Claude Desktop. The server must be publicly accessible (localhost is not supported).

### Adding a Connector

1. **Pro/Max plans**: Navigate to **Customize > Connectors** > click "+" > "Add custom connector"
2. **Team/Enterprise**: Owner adds it under **Organization settings > Connectors**, then members connect

### Configuration

```json
{
  "url": "https://your-mcp-server.com/mcp",
  "auth": {
    "type": "oauth",
    "clientId": "your-client-id",
    "clientSecret": "your-client-secret"
  }
}
```

### Network Requirements

- Server must be publicly accessible from the internet
- Claude connects from Anthropic's cloud infrastructure, not from your local machine
- Allowlist Anthropic IP addresses if your server has a firewall

### Security Notes

- Only connect to servers you trust
- Review permissions when authenticating
- You can disable tools you don't need

See also: [Building custom connectors via remote MCP servers](https://support.claude.com/en/articles/11503834-building-custom-connectors-via-remote-mcp-servers)
