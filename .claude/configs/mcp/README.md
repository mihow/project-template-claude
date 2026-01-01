# MCP Server Configurations

Model Context Protocol (MCP) server configurations for Claude Code.

## What is MCP?

MCP enables Claude to interact with external tools and data sources through a standardized protocol.

**Official Docs:** https://modelcontextprotocol.io/

## Active MCP Servers

Document your actively used MCP servers here.

### Standard Servers

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/allowed/path"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

### Custom MCP Servers

Add your custom MCP server configs here.

#### Example: Qwen MCP Server

```json
{
  "mcpServers": {
    "qwen": {
      "command": "npx",
      "args": ["-y", "mcp-ollama"],
      "env": {
        "OLLAMA_HOST": "http://localhost:11434"
      }
    }
  }
}
```

## Installation

```bash
# Copy to Claude config
cp mcp-config.json ~/.claude/mcp.json

# Or link for version control
ln -s $(pwd)/mcp-config.json ~/.claude/mcp.json
```

## Testing MCP Servers

```bash
# Test MCP server
npx @modelcontextprotocol/inspector npx -y mcp-ollama

# Debug MCP issues
claude --verbose
```

## Available MCP Servers

| Server | Purpose | Install |
|--------|---------|---------|
| filesystem | File access | `npx @modelcontextprotocol/server-filesystem` |
| github | GitHub API | `npx @modelcontextprotocol/server-github` |
| postgres | Database | `npx @modelcontextprotocol/server-postgres` |
| puppeteer | Browser automation | `npx @modelcontextprotocol/server-puppeteer` |
| fetch | HTTP requests | `npx @modelcontextprotocol/server-fetch` |
| ollama | Local LLMs | `npx mcp-ollama` |

## Custom MCP Server Template

See: [Building MCP Servers](https://modelcontextprotocol.io/docs/building-servers)

```typescript
// server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server({
  name: "my-custom-server",
  version: "1.0.0"
});

// Define tools
server.setRequestHandler("tools/list", async () => ({
  tools: [
    {
      name: "my_tool",
      description: "Does something useful",
      inputSchema: {
        type: "object",
        properties: {
          input: { type: "string" }
        }
      }
    }
  ]
}));

// Handle tool calls
server.setRequestHandler("tools/call", async (request) => {
  // Implementation
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

## Troubleshooting

### MCP Server Not Found
```bash
# Check if installed
which npx
npm list -g @modelcontextprotocol/server-filesystem
```

### Connection Issues
```bash
# Check Claude logs
tail -f ~/.claude/logs/mcp.log

# Verbose mode
claude --verbose
```

### Environment Variables
Make sure required env vars are set:
```bash
export GITHUB_TOKEN="ghp_..."
export OLLAMA_HOST="http://localhost:11434"
```

---

**See Also:**
- [Official MCP Docs](https://modelcontextprotocol.io/)
- [Available Servers](https://github.com/modelcontextprotocol/servers)
- [Building Servers](https://modelcontextprotocol.io/docs/building-servers)
